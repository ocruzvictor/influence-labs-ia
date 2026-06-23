const crypto = require('node:crypto');

const CERT_PATH_RE = /^\/SimpleNotificationService-[A-Za-z0-9_-]+\.pem$/;
const SUPPORTED_TYPES = new Set(['Notification', 'SubscriptionConfirmation']);
const SIGNATURE_ALGORITHMS = {
  1: 'RSA-SHA1',
  2: 'RSA-SHA256',
};

class SnsValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SnsValidationError';
  }
}

function isAwsSnsHostname(hostname) {
  const host = String(hostname || '').toLowerCase();
  const suffix = host.endsWith('.amazonaws.com.cn')
    ? '.amazonaws.com.cn'
    : '.amazonaws.com';

  if (!host.endsWith(suffix)) return false;
  const service = host.slice(0, -suffix.length).split('.')[0];
  return service === 'sns' || service === 'sns-fips';
}

function parseTopicArn(value) {
  const match = /^arn:(aws|aws-cn|aws-us-gov):sns:([a-z0-9-]+):\d{12}:[A-Za-z0-9_-]+$/.exec(String(value || ''));
  if (!match) throw new SnsValidationError('Invalid SNS TopicArn');
  return { partition: match[1], region: match[2], arn: value };
}

function expectedSnsHostname(topicArn) {
  const { partition, region } = parseTopicArn(topicArn);
  return partition === 'aws-cn'
    ? `sns.${region}.amazonaws.com.cn`
    : `sns.${region}.amazonaws.com`;
}

function parseAwsSnsUrl(value, { certificate = false, topicArn = null } = {}) {
  let url;
  try {
    url = new URL(value);
  } catch (_) {
    throw new SnsValidationError('Invalid AWS SNS URL');
  }

  if (url.protocol !== 'https:') {
    throw new SnsValidationError('AWS SNS URL must use HTTPS');
  }
  if (url.username || url.password || (url.port && url.port !== '443')) {
    throw new SnsValidationError('AWS SNS URL contains forbidden authority fields');
  }
  if (!isAwsSnsHostname(url.hostname)) {
    throw new SnsValidationError('AWS SNS URL host is not allowed');
  }
  if (topicArn && url.hostname.toLowerCase() !== expectedSnsHostname(topicArn)) {
    throw new SnsValidationError('AWS SNS URL host does not match TopicArn region');
  }
  if (certificate && (!CERT_PATH_RE.test(url.pathname) || url.search || url.hash)) {
    throw new SnsValidationError('AWS SNS certificate URL path is not allowed');
  }

  return url;
}

function validateSigningCertUrl(value, topicArn) {
  return parseAwsSnsUrl(value, { certificate: true, topicArn }).toString();
}

function validateSubscribeUrl(value, envelope = {}) {
  const url = parseAwsSnsUrl(value, { topicArn: envelope.TopicArn });
  if (url.searchParams.get('Action') !== 'ConfirmSubscription'
      || url.searchParams.get('TopicArn') !== envelope.TopicArn
      || url.searchParams.get('Token') !== envelope.Token) {
    throw new SnsValidationError('SNS SubscribeURL parameters do not match envelope');
  }
  return url.toString();
}

function requireString(envelope, field) {
  if (typeof envelope?.[field] !== 'string' || envelope[field].length === 0) {
    throw new SnsValidationError(`Missing SNS field: ${field}`);
  }
  return envelope[field];
}

function buildCanonicalString(envelope) {
  const type = requireString(envelope, 'Type');
  let fields;

  if (type === 'Notification') {
    fields = ['Message', 'MessageId'];
    if (Object.prototype.hasOwnProperty.call(envelope, 'Subject')) fields.push('Subject');
    fields.push('Timestamp', 'TopicArn', 'Type');
  } else if (type === 'SubscriptionConfirmation') {
    fields = [
      'Message',
      'MessageId',
      'SubscribeURL',
      'Timestamp',
      'Token',
      'TopicArn',
      'Type',
    ];
  } else {
    throw new SnsValidationError(`Unsupported SNS message type: ${type}`);
  }

  return fields.map(field => `${field}\n${requireString(envelope, field)}\n`).join('');
}

function createCertificateCache({
  fetchImpl,
  nowFn = Date.now,
  ttlMs = 60 * 60 * 1000,
  timeoutMs = 5000,
  maxCertificateBytes = 64 * 1024,
} = {}) {
  const doFetch = fetchImpl || ((...args) => fetch(...args));
  const cache = new Map();
  const inflight = new Map();

  async function downloadCertificate(url) {
    const options = { method: 'GET', redirect: 'error' };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    timeout.unref?.();
    options.signal = controller.signal;

    let response;
    try {
      response = await doFetch(url, options);
    } finally {
      clearTimeout(timeout);
    }
    if (!response?.ok) {
      throw new SnsValidationError(`Failed to download SNS certificate: ${response?.status}`);
    }
    if (response.url) validateSigningCertUrl(response.url);

    const certificate = await response.text();
    if (!certificate || Buffer.byteLength(certificate, 'utf8') > maxCertificateBytes) {
      throw new SnsValidationError('Invalid SNS certificate response');
    }
    return certificate;
  }

  async function getCertificate(value, topicArn) {
    const url = validateSigningCertUrl(value, topicArn);
    const cached = cache.get(url);
    if (cached && nowFn() < cached.expiresAt) return cached.certificate;
    if (inflight.has(url)) return inflight.get(url);

    const pending = (async () => {
      const certificate = await downloadCertificate(url);
      let parsed;
      try { parsed = new crypto.X509Certificate(certificate); } catch {
        throw new SnsValidationError('Invalid SNS signing certificate');
      }
      const now = nowFn();
      const validFrom = Date.parse(parsed.validFrom);
      const validTo = Date.parse(parsed.validTo);
      if (!Number.isFinite(validFrom) || !Number.isFinite(validTo) || now < validFrom || now > validTo) {
        throw new SnsValidationError('SNS signing certificate is not currently valid');
      }
      if (!['rsa', 'rsa-pss'].includes(parsed.publicKey.asymmetricKeyType)) {
        throw new SnsValidationError('SNS signing certificate key is not RSA');
      }
      cache.set(url, { certificate, expiresAt: Math.min(now + ttlMs, validTo) });
      return certificate;
    })();
    inflight.set(url, pending);

    try {
      return await pending;
    } finally {
      inflight.delete(url);
    }
  }

  return {
    getCertificate,
    clear: () => cache.clear(),
    _state: {
      get cachedUrls() {
        return cache.size;
      },
    },
  };
}

function validateEnvelope(envelope, expectedTopicArns) {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    throw new SnsValidationError('SNS envelope must be an object');
  }
  if (!SUPPORTED_TYPES.has(envelope.Type)) {
    throw new SnsValidationError(`Unsupported SNS message type: ${envelope.Type}`);
  }

  requireString(envelope, 'MessageId');
  requireString(envelope, 'TopicArn');
  requireString(envelope, 'Signature');
  requireString(envelope, 'SigningCertURL');

  const version = String(envelope.SignatureVersion || '');
  if (!SIGNATURE_ALGORITHMS[version]) {
    throw new SnsValidationError(`Unsupported SNS signature version: ${version}`);
  }

  if (expectedTopicArns?.size && !expectedTopicArns.has(envelope.TopicArn)) {
    throw new SnsValidationError('Unexpected SNS TopicArn');
  }
}

function normalizeExpectedTopics({ expectedTopicArn, expectedTopicArns } = {}) {
  const topics = new Set();
  if (expectedTopicArn) topics.add(expectedTopicArn);
  if (Array.isArray(expectedTopicArns) || expectedTopicArns instanceof Set) {
    for (const topic of expectedTopicArns) topics.add(topic);
  }
  return topics;
}

async function verifySnsSignature(envelope, {
  getCertificate,
  certificateCache,
  fetchImpl,
  expectedTopicArn,
  expectedTopicArns,
} = {}) {
  const topics = normalizeExpectedTopics({ expectedTopicArn, expectedTopicArns });
  validateEnvelope(envelope, topics);
  const certUrl = validateSigningCertUrl(envelope.SigningCertURL, envelope.TopicArn);
  const canonical = buildCanonicalString(envelope);
  const algorithm = SIGNATURE_ALGORITHMS[String(envelope.SignatureVersion)];
  const loader = getCertificate
    || certificateCache?.getCertificate?.bind(certificateCache)
    || createCertificateCache({ fetchImpl }).getCertificate;
  const certificate = await loader(certUrl, envelope.TopicArn);

  let signature;
  try {
    signature = Buffer.from(envelope.Signature, 'base64');
  } catch (_) {
    throw new SnsValidationError('Invalid SNS signature encoding');
  }
  if (signature.length === 0) {
    throw new SnsValidationError('Invalid SNS signature encoding');
  }

  let verified;
  try {
    verified = crypto.verify(
      algorithm,
      Buffer.from(canonical, 'utf8'),
      certificate,
      signature,
    );
  } catch (_) {
    throw new SnsValidationError('Invalid SNS signing certificate');
  }
  if (!verified) throw new SnsValidationError('Invalid SNS signature');
  return true;
}

function parseEnvelope(value) {
  if (Buffer.isBuffer(value)) value = value.toString('utf8');
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (_) {
    throw new SnsValidationError('Invalid SNS JSON');
  }
}

function isDuplicateResult(value) {
  return value === true || value?.duplicate === true;
}

function createTrinksSnsHandler(options = {}) {
  const fetchImpl = options.fetchImpl || ((...args) => fetch(...args));
  const certificateCache = options.certificateCache || createCertificateCache({
    fetchImpl,
    nowFn: options.nowFn,
    ttlMs: options.certificateTtlMs,
    timeoutMs: options.timeoutMs,
  });
  const dedupeMessage = options.dedupeMessage || options.isDuplicate || (async () => false);
  const persistEnvelope = options.persistEnvelope || options.persist || (async () => undefined);
  const processNotification = options.processNotification || options.process || (async () => undefined);
  const markSubscriptionConfirmed = options.markSubscriptionConfirmed || (async () => undefined);
  const markSubscriptionFailed = options.markSubscriptionFailed || (async () => undefined);
  const confirmSubscription = options.confirmSubscription || options.confirm || (async (url, envelope) => {
    const response = await fetchImpl(validateSubscribeUrl(url, envelope), {
      method: 'GET',
      redirect: 'error',
      signal: AbortSignal.timeout(options.timeoutMs || 5000),
    });
    if (!response?.ok) {
      throw new SnsValidationError(`SNS subscription confirmation failed: ${response?.status}`);
    }
    return true;
  });

  async function verify(envelope, expectedTopicArn = options.expectedTopicArn) {
    return verifySnsSignature(envelope, {
      certificateCache,
      getCertificate: options.getCertificate,
      expectedTopicArn,
      expectedTopicArns: options.expectedTopicArns,
    });
  }

  async function handle(value) {
    const envelope = parseEnvelope(value);
    let expectedTopicArn = options.expectedTopicArn;
    if (options.resolveExpectedTopicArn) {
      expectedTopicArn = await options.resolveExpectedTopicArn(envelope);
      const bootstrapAllowed = options.allowSubscriptionBootstrap
        && envelope.Type === 'SubscriptionConfirmation';
      if (!expectedTopicArn && !bootstrapAllowed) {
        throw new SnsValidationError('SNS topic is not trusted');
      }
    }
    await verify(envelope, expectedTopicArn);

    const duplicate = await dedupeMessage(envelope.MessageId, envelope);
    if (isDuplicateResult(duplicate)) {
      return { ok: true, type: envelope.Type, duplicate: true, processed: false };
    }

    const persisted = await persistEnvelope(envelope);
    if (isDuplicateResult(persisted)) {
      return { ok: true, type: envelope.Type, duplicate: true, processed: false };
    }

    if (envelope.Type === 'SubscriptionConfirmation') {
      try {
        const confirmation = await confirmSubscription(envelope.SubscribeURL, envelope);
        await markSubscriptionConfirmed(envelope.MessageId, envelope);
        return {
          ok: true,
          type: envelope.Type,
          duplicate: false,
          confirmed: true,
          confirmation,
        };
      } catch (err) {
        await markSubscriptionFailed(envelope.MessageId, envelope, err);
        throw err;
      }
    }

    const result = await processNotification(envelope);
    return {
      ok: true,
      type: envelope.Type,
      duplicate: false,
      processed: true,
      result,
    };
  }

  return { handle, verify, certificateCache };
}

async function handleSnsMessage(envelope, options) {
  return createTrinksSnsHandler(options).handle(envelope);
}

module.exports = {
  SnsValidationError,
  buildCanonicalString,
  createCertificateCache,
  createSnsHandler: createTrinksSnsHandler,
  createTrinksSnsHandler,
  handleSnsMessage,
  isAwsSnsHostname,
  validateSigningCertUrl,
  validateSubscribeUrl,
  parseTopicArn,
  verifySnsSignature,
};
