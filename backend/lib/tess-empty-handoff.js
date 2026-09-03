/**
 * P0.7 — tess.empty + credits=0 ⇒ handoff.human + bot_thread_state silence.
 */

const { isOwnerPhone } = require('./owner-access');

function shouldHandoffEmptyTess(credits) {
  return Number.isFinite(credits) && credits === 0;
}

async function handleEmptyTessHandoff({
  credits,
  phone,
  db,
  kapsoConversationId,
  markHumanHandled,
  shouldEmitHandoff,
  emitOperationalEvent,
}) {
  if (!shouldHandoffEmptyTess(credits)) {
    return { handoff: false, silenced: false };
  }

  let silenced = false;
  if (phone && !isOwnerPhone(phone)) {
    await markHumanHandled(phone, 'handoff');
    silenced = true;
  }

  let handoff = false;
  if (shouldEmitHandoff(phone)) {
    await emitOperationalEvent(db, {
      event: 'handoff.human',
      clientPhone: phone,
      kapsoConversationId,
      payload: { source: 'tess.empty', credits: 0 },
    });
    handoff = true;
  }

  return { handoff, silenced };
}

module.exports = {
  shouldHandoffEmptyTess,
  handleEmptyTessHandoff,
};
