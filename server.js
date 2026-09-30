const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.PORT) || 3000;
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const PAGE_PATH = path.join(__dirname, '3_quizbot_real_ai_api.html');
const MAX_BODY_SIZE = 8 * 1024;

function sendJson(response, status, data){
  response.writeHead(status, {'Content-Type':'application/json; charset=utf-8'});
  response.end(JSON.stringify(data));
}

function invalidRequest(message, statusCode = 400){
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function readJson(request){
  return new Promise((resolve, reject)=>{
    let body = '';
    request.on('data', chunk=>{
      body += chunk;
      if(Buffer.byteLength(body) > MAX_BODY_SIZE){
        reject(invalidRequest('Request terlalu besar.', 413));
        request.destroy();
      }
    });
    request.on('end', ()=>{
      try{
        resolve(JSON.parse(body));
      }catch{
        reject(invalidRequest('Body harus berupa JSON yang valid.'));
      }
    });
    request.on('error', reject);
  });
}

async function askOpenAI(messages, jsonMode = false){
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
    const message = data.error && data.error.message
      ? data.error.message
      : `OpenAI mengembalikan status ${response.status}.`;
    throw new Error(message);
  }
  const content = data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : null;
  if(typeof content !== 'string' || !content.trim()){
    throw new Error('OpenAI tidak mengembalikan jawaban.');
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

async function handleApi(request, response, pathname){
  if(pathname === '/api/health' && request.method === 'GET'){
    sendJson(response, 200, {configured:Boolean(process.env.OPENAI_API_KEY)});
    return;
  }
  if(request.method !== 'POST'){
    sendJson(response, 405, {error:'Method tidak diizinkan.'});
    return;
  }
  if(!process.env.OPENAI_API_KEY){
    sendJson(response, 503, {error:'OPENAI_API_KEY belum diatur pada server.'});
    return;
  }

  const body = await readJson(request);
  if(!body || typeof body !== 'object' || Array.isArray(body)){
    throw invalidRequest('Body harus berupa objek JSON.');
  }
  if(pathname === '/api/questions'){
    if(typeof body.topic !== 'string' || !body.topic.trim() || body.topic.length > 120){
      throw invalidRequest('Topik wajib diisi dan maksimal 120 karakter.');
    }
    const content = await askOpenAI([
      {
        role:'system',
        content:'Kamu adalah pembuat soal kuis berbahasa Indonesia. Hasilkan tepat 5 soal pilihan ganda tingkat mahasiswa. Untuk setiap soal, hanya ada satu jawaban benar dan tepat 4 opsi.'
      },
      {
        role:'user',
        content:`Buat soal tentang topik berikut: ${body.topic.trim()}. Variasikan tingkat kesulitan. Balas sebagai objek JSON dengan format {"questions":[{"q":"pertanyaan","opts":["opsi1","opsi2","opsi3","opsi4"],"a":0,"explain":"penjelasan singkat"}]}. Nilai a adalah indeks jawaban benar, mulai dari 0.`
      }
    ], true);
    let parsed;
    try{
      parsed = JSON.parse(content);
    }catch{
      throw new Error('OpenAI mengembalikan JSON yang tidak valid.');
    }
    sendJson(response, 200, {questions:validateQuestions(parsed)});
    return;
  }
  if(pathname === '/api/tip'){
    if(
      typeof body.topic !== 'string' ||
      !body.topic.trim() ||
      !Number.isInteger(body.score) ||
      !Number.isInteger(body.total) ||
      body.total < 1 ||
      body.score < 0 ||
      body.score > body.total
    ){
      throw invalidRequest('Data hasil kuis tidak valid.');
    }
    const tip = await askOpenAI([
      {
        role:'system',
        content:'Berikan satu tips belajar yang singkat, maksimal dua kalimat, dalam bahasa Indonesia dengan nada suportif.'
      },
      {
        role:'user',
        content:`Mahasiswa mengerjakan kuis topik "${body.topic.trim()}" dan mendapat skor ${body.score} dari ${body.total}. Berikan tips belajar untuk membantunya memahami topik tersebut.`
      }
    ]);
    sendJson(response, 200, {tip:tip.trim()});
    return;
  }
  sendJson(response, 404, {error:'Endpoint tidak ditemukan.'});
}

const server = http.createServer(async (request, response)=>{
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  if(url.pathname.startsWith('/api/')){
    try{
      await handleApi(request, response, url.pathname);
    }catch(error){
      console.error('API request failed:', error.message);
      if(!response.headersSent){
        sendJson(response, error.statusCode || 502, {error:error.message || 'Permintaan ke OpenAI gagal.'});
      }
    }
    return;
  }

  if(request.method !== 'GET' || (url.pathname !== '/' && url.pathname !== '/3_quizbot_real_ai_api.html')){
    response.writeHead(404);
    response.end('Not found');
    return;
  }
  fs.readFile(PAGE_PATH, (error, content)=>{
    if(error){
      console.error('Could not read quiz page:', error.message);
      response.writeHead(500);
      response.end('Could not load quiz page.');
      return;
    }
    response.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
    response.end(content);
  });
});

server.listen(PORT, ()=>{
  console.log(`QuizBot is running at http://localhost:${PORT}`);
});
