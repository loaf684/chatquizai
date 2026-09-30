const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

async function askOpenAI(messages, jsonMode = false){
  if(!process.env.OPENAI_API_KEY){
    const error = new Error('OPENAI_API_KEY belum diatur pada server.');
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      ...(jsonMode ? {response_format:{type:'json_object'}} : {})
    })
  });

  const data = await response.json();
  if(!response.ok){
    const error = new Error(data.error && data.error.message
      ? data.error.message
      : `OpenAI mengembalikan status ${response.status}.`);
    error.statusCode = 502;
    throw error;
  }
  const content = data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : null;
  if(typeof content !== 'string' || !content.trim()){
    const error = new Error('OpenAI tidak mengembalikan jawaban.');
    error.statusCode = 502;
    throw error;
  }
  return content;
}

function validateQuestions(value){
  if(!value || !Array.isArray(value.questions) || value.questions.length !== 5){
    throw new Error('AI mengembalikan format soal yang tidak valid.');
  }
  for(const question of value.questions){
    if(
      !question ||
      typeof question.q !== 'string' ||
      !Array.isArray(question.opts) ||
      question.opts.length !== 4 ||
      !question.opts.every(option=>typeof option === 'string') ||
      !Number.isInteger(question.a) ||
      question.a < 0 ||
      question.a > 3 ||
      typeof question.explain !== 'string'
    ){
      throw new Error('AI mengembalikan format soal yang tidak valid.');
    }
  }
  return value.questions;
}

function sendError(response, error){
  console.error('API request failed:', error.message);
  response.status(error.statusCode || 502).json({
    error:error.message || 'Permintaan ke OpenAI gagal.'
  });
}

module.exports = {askOpenAI, validateQuestions, sendError};
