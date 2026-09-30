const {askGemini, parseQuestions, sendError} = require('../lib/gemini');
const {checkRateLimit} = require('../lib/rate-limit');

const QUESTION_COUNTS = [5, 10, 15];
const DIFFICULTIES = ['Mudah', 'Sedang', 'Sulit'];

module.exports = async (request, response)=>{
  if(request.method !== 'POST'){
    response.setHeader('Allow', 'POST');
    response.status(405).json({error:'Method tidak diizinkan.'});
    return;
  }
  const {topic, count = 5, difficulty = 'Sedang'} = request.body || {};
  if(
    typeof topic !== 'string' ||
    !topic.trim() ||
    topic.length > 120 ||
    !QUESTION_COUNTS.includes(count) ||
    !DIFFICULTIES.includes(difficulty)
  ){
    response.status(400).json({error:'Pilih topik, jumlah soal 5/10/15, dan tingkat kesulitan yang tersedia.'});
    return;
  }

  try{
    const limit = await checkRateLimit(request, count / 5);
    response.setHeader('X-RateLimit-Mode', limit.mode);
    if(!limit.allowed){
      response.setHeader('Retry-After', String(limit.retryAfter));
      response.status(429).json({
        error:`Batas penggunaan tercapai. Coba lagi dalam ${Math.ceil(limit.retryAfter / 60)} menit.`
      });
      return;
    }
    const content = await askGemini(
      `Kamu adalah pembuat soal kuis berbahasa Indonesia. Hasilkan tepat ${count} soal pilihan ganda tingkat mahasiswa dengan tingkat kesulitan ${difficulty.toLowerCase()}. Setiap soal hanya memiliki satu jawaban benar dan tepat 4 opsi.`,
      `Buat soal tentang topik berikut: ${topic.trim()}. Tingkat kesulitan: ${difficulty}. Balas sebagai objek JSON dengan format {"questions":[{"q":"pertanyaan","opts":["opsi1","opsi2","opsi3","opsi4"],"a":0,"explain":"penjelasan singkat"}]}. Hasilkan tepat ${count} soal. Nilai a adalah indeks jawaban benar, mulai dari 0.`,
      true
    );
    response.status(200).json({questions:parseQuestions(content, count)});
  }catch(error){
    sendError(response, error);
  }
};
