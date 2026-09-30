const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';

async function askGemini(systemInstruction, prompt, jsonMode = false){
  if(!process.env.GEMINI_API_KEY){
    const error = new Error('GEMINI_API_KEY belum diatur di Vercel.');
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: 'POST',
      headers: {
        'x-goog-api-key': process.env.GEMINI_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        systemInstruction: {parts:[{text:systemInstruction}]},
        contents: [{role:'user', parts:[{text:prompt}]}],
        ...(jsonMode ? {generationConfig:{responseMimeType:'application/json'}} : {})
      })
    }
  );

  const data = await response.json();
  if(!response.ok){
    const error = new Error(data.error && data.error.message
      ? data.error.message
      : `Gemini mengembalikan status ${response.status}.`);
    error.statusCode = 502;
    throw error;
  }

  const content = data.candidates &&
    data.candidates[0] &&
    data.candidates[0].content &&
    Array.isArray(data.candidates[0].content.parts)
      ? data.candidates[0].content.parts.map(part=>part.text || '').join('')
      : '';
  if(!content.trim()){
    const error = new Error('Gemini tidak mengembalikan jawaban teks.');
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
  console.error('Gemini API request failed:', error.message);
  response.status(error.statusCode || 502).json({
    error:error.message || 'Permintaan ke Gemini gagal.'
  });
}

module.exports = {askGemini, validateQuestions, sendError};
