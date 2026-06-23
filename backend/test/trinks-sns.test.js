const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const {
  SnsValidationError,
  buildCanonicalString,
  createCertificateCache,
  createTrinksSnsHandler,
  validateSigningCertUrl,
  verifySnsSignature,
} = require('../lib/trinks-sns');

const CERT_URL = 'https://sns.us-east-1.amazonaws.com/'
  + 'SimpleNotificationService-0123456789abcdef.pem';
const TOPIC_ARN = 'arn:aws:sns:us-east-1:123456789012:trinks';
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
});
const PUBLIC_KEY_PEM = publicKey.export({ type: 'spki', format: 'pem' });
const CERTIFICATE_PEM = `-----BEGIN CERTIFICATE-----
MIICyDCCAbACCQDy0MKe1CF5rDANBgkqhkiG9w0BAQsFADAmMSQwIgYDVQQDDBtz
bnMudXMtZWFzdC0xLmFtYXpvbmF3cy5jb20wHhcNMjYwNjE5MTQwMzIwWhcNMzYw
NjE2MTQwMzIwWjAmMSQwIgYDVQQDDBtzbnMudXMtZWFzdC0xLmFtYXpvbmF3cy5j
b20wggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCreaIiXBjt7x1sMeU/
dS01NsjZ/NaUhttCQj47aelWsNEJApF8KDSOhnC1LiQbHevkI8hYW4dsI9DhhT1U
O/MNOhvp3qPrlqQFxT/mvV+IfoXpHU9fptUrbdor3gF67RH0wOhaeqpzcs4J62b2
VvMopPOqOx8Nkd8PnF7uDLdUUQAqdgS02Ve/VHS0gg1do6u3Qxgad84EZlYma1AE
EbAWJu7WyeaKa9ulrUtexkXnh7D36HdQICsDTKa5a1e3/XZsYYAnhLrOTIv/NRxr
gQb++MrIP08ECXxurfn26m+nrGuehN5Vb9M4V9nBY1wELiwv1d3Sbc9EPuDmnMp4
PH0TAgMBAAEwDQYJKoZIhvcNAQELBQADggEBAJXrmoIGVKu8JDLycUGJfC7xh2/p
Y6Ui4doBQ/MDCFwUtZbMy/863llGjt9UhPNlCTIQFMA3Z83s14yn88QXoAuzv1tP
8r7gl8KOTenOdFH7s2a++m1hssL/94HXZ8EC7yFOOnrEf0wStnJHYFgzY30YcXh4
36b+gS+1IJwiGVq+n3E5z57WjacbfQPoZj/zqUbbbmVszHSnGiqFp5AKe8wQvXZH
7RWs7Ljpi5ZsKvuHVKfjpyZbIo4IPtderbBAD/f9UhBj8wdDzAqKxHVX+ROlcTyy
ac02caR1qxSGBUKoT1Cj2pzkswhlGqQ1ddkuGtwq+F8JTxiGeBa+/AbPmNc=
-----END CERTIFICATE-----`;

function notification(overrides = {}) {
  return {
    Type: 'Notification',
    MessageId: 'message-1',
    TopicArn: TOPIC_ARN,
    Subject: 'Trinks event',
    Message: '{"event":3}',
    Timestamp: '2026-06-18T12:00:00.000Z',
    SignatureVersion: '2',
    SigningCertURL: CERT_URL,
    Signature: 'pending',
    ...overrides,
  };
}

function confirmation(overrides = {}) {
  return {
    Type: 'SubscriptionConfirmation',
    MessageId: 'confirmation-1',
    Token: 'token-123',
    TopicArn: TOPIC_ARN,
    Message: 'Confirm this subscription',
    SubscribeURL: 'https://sns.us-east-1.amazonaws.com/'
      + `?Action=ConfirmSubscription&Token=token-123&TopicArn=${encodeURIComponent(TOPIC_ARN)}`,
    Timestamp: '2026-06-18T12:00:00.000Z',
    SignatureVersion: '2',
    SigningCertURL: CERT_URL,
    Signature: 'pending',
    ...overrides,
  };
}

function signEnvelope(envelope) {
  const algorithm = envelope.SignatureVersion === '1' ? 'RSA-SHA1' : 'RSA-SHA256';
  return {
    ...envelope,
    Signature: crypto.sign(
      algorithm,
      Buffer.from(buildCanonicalString(envelope), 'utf8'),
      privateKey,
    ).toString('base64'),
  };
}

function certificateResponse() {
  return {
    ok: true,
    status: 200,
    url: CERT_URL,
    text: async () => CERTIFICATE_PEM,
  };
}

test('SigningCertURL aceita somente HTTPS, host SNS AWS e path do certificado', () => {
  assert.equal(validateSigningCertUrl(CERT_URL), CERT_URL);
  assert.equal(
    validateSigningCertUrl(
      'https://sns.cn-north-1.amazonaws.com.cn/SimpleNotificationService-a.pem',
    ),
    'https://sns.cn-north-1.amazonaws.com.cn/SimpleNotificationService-a.pem',
  );

  const invalid = [
    'http://sns.us-east-1.amazonaws.com/SimpleNotificationService-a.pem',
    'https://sns.us-east-1.amazonaws.com.evil.test/SimpleNotificationService-a.pem',
    'https://example.amazonaws.com/SimpleNotificationService-a.pem',
    'https://sns.us-east-1.amazonaws.com/not-sns.pem',
    'https://sns.us-east-1.amazonaws.com/SimpleNotificationService-a.pem?redirect=1',
    'https://user@sns.us-east-1.amazonaws.com/SimpleNotificationService-a.pem',
  ];
  for (const url of invalid) {
    assert.throws(() => validateSigningCertUrl(url), SnsValidationError, url);
  }
});

test('canonical string de Notification segue ordem AWS e inclui Subject quando presente', () => {
  const envelope = notification({ Signature: 'unused' });
  assert.equal(
    buildCanonicalString(envelope),
    'Message\n{"event":3}\n'
      + 'MessageId\nmessage-1\n'
      + 'Subject\nTrinks event\n'
      + 'Timestamp\n2026-06-18T12:00:00.000Z\n'
      + `TopicArn\n${TOPIC_ARN}\n`
      + 'Type\nNotification\n',
  );

  delete envelope.Subject;
  assert.doesNotMatch(buildCanonicalString(envelope), /Subject/);
});

test('canonical string de SubscriptionConfirmation segue ordem AWS', () => {
  const envelope = confirmation({ Signature: 'unused' });
  assert.equal(
    buildCanonicalString(envelope),
    'Message\nConfirm this subscription\n'
      + 'MessageId\nconfirmation-1\n'
      + `SubscribeURL\n${envelope.SubscribeURL}\n`
      + 'Timestamp\n2026-06-18T12:00:00.000Z\n'
      + 'Token\ntoken-123\n'
      + `TopicArn\n${TOPIC_ARN}\n`
      + 'Type\nSubscriptionConfirmation\n',
  );
});

test('verifica SignatureVersion 1 (SHA1withRSA) e 2 (SHA256withRSA)', async () => {
  const getCertificate = async () => PUBLIC_KEY_PEM;
  await verifySnsSignature(signEnvelope(notification({ SignatureVersion: '1' })), {
    getCertificate,
    expectedTopicArn: TOPIC_ARN,
  });
  await verifySnsSignature(signEnvelope(notification({ SignatureVersion: '2' })), {
    getCertificate,
    expectedTopicArn: TOPIC_ARN,
  });
});

test('rejeita assinatura alterada, versao desconhecida e TopicArn inesperado', async () => {
  const getCertificate = async () => PUBLIC_KEY_PEM;
  const signed = signEnvelope(notification());

  await assert.rejects(
    () => verifySnsSignature({ ...signed, Message: 'tampered' }, { getCertificate }),
    /Invalid SNS signature/,
  );
  await assert.rejects(
    () => verifySnsSignature(
      { ...signed, SignatureVersion: '3' },
      { getCertificate },
    ),
    /Unsupported SNS signature version/,
  );
  await assert.rejects(
    () => verifySnsSignature(signed, {
      getCertificate,
      expectedTopicArn: 'arn:aws:sns:us-east-1:123456789012:other',
    }),
    /Unexpected SNS TopicArn/,
  );
});

test('cacheia certificado por TTL e coalesce downloads concorrentes', async () => {
  let clock = Date.parse('2026-06-20T12:00:00Z');
  let calls = 0;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const cache = createCertificateCache({
    nowFn: () => clock,
    ttlMs: 100,
    fetchImpl: async () => {
      calls++;
      await gate;
      return certificateResponse();
    },
  });

  const first = cache.getCertificate(CERT_URL);
  const concurrent = cache.getCertificate(CERT_URL);
  release();
  assert.equal(await first, CERTIFICATE_PEM);
  assert.equal(await concurrent, CERTIFICATE_PEM);
  assert.equal(calls, 1);

  await cache.getCertificate(CERT_URL);
  assert.equal(calls, 1, 'hit dentro do TTL');

  clock += 101;
  await cache.getCertificate(CERT_URL);
  assert.equal(calls, 2, 'novo download depois do TTL');
});

test('Notification valida, persiste e processa via callbacks injetados', async () => {
  const calls = [];
  const envelope = signEnvelope(notification());
  const handler = createTrinksSnsHandler({
    expectedTopicArn: TOPIC_ARN,
    getCertificate: async () => PUBLIC_KEY_PEM,
    fetchImpl: async (url) => {
      calls.push(`fetch:${url}`);
      return certificateResponse();
    },
    dedupeMessage: async (messageId, value) => {
      calls.push(`dedupe:${messageId}`);
      assert.equal(value, envelope);
      return false;
    },
    persistEnvelope: async (value) => {
      calls.push(`persist:${value.MessageId}`);
    },
    processNotification: async (value) => {
      calls.push(`process:${value.MessageId}`);
      return { accepted: true };
    },
  });

  const result = await handler.handle(envelope);
  assert.deepEqual(result, {
    ok: true,
    type: 'Notification',
    duplicate: false,
    processed: true,
    result: { accepted: true },
  });
  assert.deepEqual(calls, [
    'dedupe:message-1',
    'persist:message-1',
    'process:message-1',
  ]);
});

test('duplicata nao persiste nem processa', async () => {
  let persisted = false;
  let processed = false;
  const handler = createTrinksSnsHandler({
    getCertificate: async () => PUBLIC_KEY_PEM,
    fetchImpl: async () => certificateResponse(),
    dedupeMessage: async () => true,
    persistEnvelope: async () => { persisted = true; },
    processNotification: async () => { processed = true; },
  });

  const result = await handler.handle(signEnvelope(notification()));
  assert.equal(result.duplicate, true);
  assert.equal(result.processed, false);
  assert.equal(persisted, false);
  assert.equal(processed, false);
});

test('persistencia pode sinalizar duplicata atomica e impedir processamento', async () => {
  let processed = false;
  const handler = createTrinksSnsHandler({
    getCertificate: async () => PUBLIC_KEY_PEM,
    fetchImpl: async () => certificateResponse(),
    persistEnvelope: async () => ({ duplicate: true }),
    processNotification: async () => { processed = true; },
  });

  const result = await handler.handle(signEnvelope(notification()));
  assert.equal(result.duplicate, true);
  assert.equal(processed, false);
});

test('SubscriptionConfirmation confirma SubscribeURL somente apos assinatura valida', async () => {
  const calls = [];
  const signed = signEnvelope(confirmation());
  const handler = createTrinksSnsHandler({
    getCertificate: async () => PUBLIC_KEY_PEM,
    fetchImpl: async () => certificateResponse(),
    persistEnvelope: async () => { calls.push('persist'); },
    confirmSubscription: async (url, envelope) => {
      calls.push(`confirm:${url}`);
      assert.equal(envelope.MessageId, 'confirmation-1');
      return 'confirmed';
    },
  });

  const result = await handler.handle(JSON.stringify(signed));
  assert.equal(result.confirmed, true);
  assert.equal(result.confirmation, 'confirmed');
  assert.deepEqual(calls, ['persist', `confirm:${signed.SubscribeURL}`]);

  calls.length = 0;
  await assert.rejects(
    () => handler.handle(JSON.stringify({ ...signed, Token: 'tampered' })),
    /Invalid SNS signature/,
  );
  assert.deepEqual(calls, [], 'assinatura invalida nao persiste nem confirma');
});

test('confirmacao padrao visita SubscribeURL depois da verificacao', async () => {
  const urls = [];
  const signed = signEnvelope(confirmation());
  const handler = createTrinksSnsHandler({
    getCertificate: async () => PUBLIC_KEY_PEM,
    fetchImpl: async (url, options) => {
      urls.push({ url, method: options.method });
      if (url === CERT_URL) return certificateResponse();
      return { ok: true, status: 200 };
    },
  });

  await handler.handle(signed);
  assert.deepEqual(urls, [
    { url: signed.SubscribeURL, method: 'GET' },
  ]);
});

test('bootstrap dinamico aceita somente SubscriptionConfirmation assinada', async () => {
  const signedConfirmation = signEnvelope(confirmation());
  const handler = createTrinksSnsHandler({
    getCertificate: async () => PUBLIC_KEY_PEM,
    resolveExpectedTopicArn: async () => null,
    allowSubscriptionBootstrap: true,
    confirmSubscription: async () => true,
  });

  const result = await handler.handle(signedConfirmation);
  assert.equal(result.confirmed, true);

  await assert.rejects(
    () => handler.handle(signEnvelope(notification())),
    /SNS topic is not trusted/,
  );
});

test('topico resolvido dinamicamente restringe mensagens futuras', async () => {
  const handler = createTrinksSnsHandler({
    getCertificate: async () => PUBLIC_KEY_PEM,
    resolveExpectedTopicArn: async () => TOPIC_ARN,
  });

  await handler.handle(signEnvelope(notification()));
  await assert.rejects(
    () => handler.handle(signEnvelope(notification({
      TopicArn: 'arn:aws:sns:us-east-1:123456789012:other',
    }))),
    /Unexpected SNS TopicArn/,
  );
});
