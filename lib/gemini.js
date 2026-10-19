const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

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
    error.statusCode = response.status === 429 ? 429 : 502;
    if(response.status === 429){
      error.message = 'Kuota gratis Gemini sedang habis atau mencapai batas. Tunggu hingga kuota pulih, lalu coba lagi; periksa Google AI Studio jika masih berlanjut.';
    }
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

function validateQuestions(value, expectedCount = 5){
  if(!value || !Array.isArray(value.questions) || value.questions.length !== expectedCount){
    throw new Error(`AI mengembalikan format soal yang tidak valid (seharusnya ${expectedCount} soal).`);
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

function parseQuestions(content, expectedCount = 5){
  const candidates = [content.trim()];
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if(fenced) candidates.push(fenced[1].trim());

  const objectStart = content.indexOf('{');
  const objectEnd = content.lastIndexOf('}');
  if(objectStart >= 0 && objectEnd > objectStart){
    candidates.push(content.slice(objectStart, objectEnd + 1));
  }

  let parseError;
  for(const candidate of new Set(candidates)){
    try{
      return validateQuestions(JSON.parse(candidate), expectedCount);
    }catch(error){
      if(error instanceof SyntaxError) parseError = error;
      else throw error;
    }
  }
  throw new Error(
    `Gemini mengembalikan JSON soal yang tidak valid${parseError ? ` (${parseError.message})` : ''}.`
  );
}

function sendError(response, error){
  console.error('Gemini API request failed:', error.message);
  if(error.statusCode === 429){
    response.setHeader('Retry-After', '60');
  }
  response.status(error.statusCode || 502).json({
    error:error.message || 'Permintaan ke Gemini gagal.'
  });
}

module.exports = {askGemini, validateQuestions, parseQuestions, sendError};
