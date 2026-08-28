/**
 * Acesso de operador — dono do salão (Tiago).
 *
 * PIN: TIAGO_NOTIFICATION_PHONE (CSV de dígitos). Fallback: 5511937750330
 * (número de trabalho do Tiago, dono e cabeleireiro/barbeiro).
 *
 * Não é admin-via-WhatsApp: só identidade no contexto TESS + não silenciar o thread.
 */

const DEFAULT_OWNER_PHONES = ['5511937750330'];

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function parseOwnerPhones(raw) {
  const fromEnv = String(raw || '')
    .split(',')
    .map((s) => digitsOnly(s))
    .filter(Boolean);
  return fromEnv.length ? fromEnv : [...DEFAULT_OWNER_PHONES];
}

function getOwnerPhones(env = process.env) {
  return parseOwnerPhones(env.TIAGO_NOTIFICATION_PHONE);
}

function isOwnerPhone(phone, ownerPhones = getOwnerPhones()) {
  const digits = digitsOnly(phone);
  if (!digits) return false;
  return ownerPhones.includes(digits);
}

function renderOwnerContext(phone, ownerPhones = getOwnerPhones()) {
  const digits = digitsOnly(phone);
  if (!isOwnerPhone(digits, ownerPhones)) return '';
  return [
    'INTERLOCUTOR: TIAGO (dono do Studio Tirrá e profissional/barbeiro).',
    `Telefone: ${digits}.`,
    'Trate-o como operador com acesso pleno aos dados do salão visíveis neste contexto (agenda/horários, profissionais, serviços, regras).',
    'Ele PODE pedir agendamento, cancelamento e reagendamento (para si, para cliente, para a cadeira dele) — use o mesmo fluxo Trinks. Não recuse por ele ser o dono.',
    'NÃO emita HANDOFF_HUMAN nesta conversa — ele já é o dono.',
    'Pedidos de alteração permanente (prompt, KB, preço, horário de funcionamento): confirme o que entendeu e deixe claro que você NÃO aplica sozinha; a equipe técnica aplica.',
  ].join('\n');
}

module.exports = {
  DEFAULT_OWNER_PHONES,
  digitsOnly,
  parseOwnerPhones,
  getOwnerPhones,
  isOwnerPhone,
  renderOwnerContext,
};
