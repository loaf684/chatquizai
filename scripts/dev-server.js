const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {askGemini, parseQuestions} = require('../lib/gemini');

const PORT = Number(process.env.PORT) || 3000;
const PAGE_PATH = path.join(__dirname, '..', 'index.html');
const MAX_BODY_SIZE = 8 * 1024;

function sendJson(response, status, data, headers = {}){
  response.writeHead(status, {'Content-Type':'application/json; charset=utf-8', ...headers});
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

async function handleApi(request, response, pathname){
  if(pathname === '/api/health' && request.method === 'GET'){
    sendJson(response, 200, {
      provider:'Gemini',
      configured:Boolean(process.env.GEMINI_API_KEY),
      setupMessage:process.env.GEMINI_API_KEY
        ? null
        : 'Tambahkan GEMINI_API_KEY di pengaturan Environment Variables, lalu restart server.'
    });
    return;
  }
  if(request.method !== 'POST'){
    sendJson(response, 405, {error:'Method tidak diizinkan.'});
    return;
  }
  if(!process.env.GEMINI_API_KEY){
    sendJson(response, 503, {error:'GEMINI_API_KEY belum diatur pada server.'});
    return;
  }

  const body = await readJson(request);
  if(!body || typeof body !== 'object' || Array.isArray(body)){
    throw invalidRequest('Body harus berupa objek JSON.');
  }
  if(pathname === '/api/questions'){
    const count = body.count === undefined ? 5 : body.count;
    const difficulty = body.difficulty || 'Sedang';
    if(
      typeof body.topic !== 'string' ||
      !body.topic.trim() ||
      body.topic.length > 120 ||
      ![5, 10, 15].includes(count) ||
      !['Mudah', 'Sedang', 'Sulit'].includes(difficulty)
    ){
      throw invalidRequest('Pilih topik, jumlah soal 5/10/15, dan tingkat kesulitan yang tersedia.');
    }
    const content = await askGemini(
      `Kamu adalah pembuat soal kuis berbahasa Indonesia. Hasilkan tepat ${count} soal pilihan ganda tingkat mahasiswa dengan tingkat kesulitan ${difficulty.toLowerCase()}. Setiap soal hanya memiliki satu jawaban benar dan tepat 4 opsi.`,
      `Buat soal tentang topik berikut: ${body.topic.trim()}. Tingkat kesulitan: ${difficulty}. Balas sebagai objek JSON dengan format {"questions":[{"q":"pertanyaan","opts":["opsi1","opsi2","opsi3","opsi4"],"a":0,"explain":"penjelasan singkat"}]}. Hasilkan tepat ${count} soal. Nilai a adalah indeks jawaban benar, mulai dari 0.`,
      true
    );
    sendJson(response, 200, {questions:parseQuestions(content, count)});
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
    const tip = await askGemini(
      'Berikan satu tips belajar yang singkat, maksimal dua kalimat, dalam bahasa Indonesia dengan nada suportif.',
      `Mahasiswa mengerjakan kuis topik "${body.topic.trim()}" dan mendapat skor ${body.score} dari ${body.total}. Berikan tips belajar untuk membantunya memahami topik tersebut.`
    );
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
      console.error('Gemini API request failed:', error.message);
      if(!response.headersSent){
        const status = error.statusCode || 502;
        const message = status === 429
          ? 'Kuota gratis Gemini sedang habis atau mencapai batas. Tunggu hingga kuota pulih, lalu coba lagi; periksa Google AI Studio jika masih berlanjut.'
          : error.message || 'Permintaan ke Gemini gagal.';
        sendJson(response, status, {error:message}, status === 429 ? {'Retry-After':'60'} : {});
      }
    }
    return;
  }

  if(request.method !== 'GET' || (url.pathname !== '/' && url.pathname !== '/index.html')){
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
