const bcrypt = require('bcryptjs');

const SECURITY_QUESTIONS = [
  { id: 'birth_city',       text: 'In what city were you born?' },
  { id: 'first_school',     text: 'What was the name of your first school?' },
  { id: 'mother_maiden',    text: "What is your mother's maiden name?" },
  { id: 'first_pet',        text: 'What was the name of your first pet?' },
  { id: 'first_car',        text: 'What was the make of your first car?' },
  { id: 'favorite_teacher', text: 'What is the name of your favorite teacher?' },
  { id: 'childhood_friend', text: 'What is the name of your best childhood friend?' },
  { id: 'street_grew_up',   text: 'What was the name of the street you grew up on?' }
];

const VALID_IDS = new Set(SECURITY_QUESTIONS.map(q => q.id));

const REQUIRED_ANSWER_COUNT = 3;

function normalizeAnswer(answer) {
  return String(answer || '').trim().toLowerCase();
}

async function hashAnswer(answer) {
  return bcrypt.hash(normalizeAnswer(answer), 10);
}

async function verifyAnswer(answer, hash) {
  return bcrypt.compare(normalizeAnswer(answer), hash);
}

function isValidQuestionId(id) {
  return VALID_IDS.has(id);
}

module.exports = {
  SECURITY_QUESTIONS,
  REQUIRED_ANSWER_COUNT,
  hashAnswer,
  verifyAnswer,
  isValidQuestionId,
  normalizeAnswer
};
