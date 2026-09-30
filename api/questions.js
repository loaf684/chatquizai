const {askGemini, validateQuestions, sendError} = require('../lib/gemini');

module.exports = async (request, response)=>{
  if(request.method !== 'POST'){
    response.setHeader('Allow', 'POST');
    response.status(405).json({error:'Method tidak diizinkan.'});
    return;
  }
  const {topic} = request.body || {};
  if(typeof topic !== 'string' || !topic.trim() || topic.length > 120){
    response.status(400).json({error:'Topik wajib diisi dan maksimal 120 karakter.'});
    return;
  }

  try{
    const content = await askGemini(
      'Kamu adalah pembuat soal kuis berbahasa Indonesia. Hasilkan tepat 5 soal pilihan ganda tingkat mahasiswa. Untuk setiap soal, hanya ada satu jawaban benar dan tepat 4 opsi.',
      `Buat soal tentang topik berikut: ${topic.trim()}. Variasikan tingkat kesulitan. Balas sebagai objek JSON dengan format {"questions":[{"q":"pertanyaan","opts":["opsi1","opsi2","opsi3","opsi4"],"a":0,"explain":"penjelasan singkat"}]}. Nilai a adalah indeks jawaban benar, mulai dari 0.`,
      true
    );
    let parsed;
    try{
      parsed = JSON.parse(content);
    }catch{
      throw new Error('Gemini mengembalikan JSON yang tidak valid.');
    }
    response.status(200).json({questions:validateQuestions(parsed)});
  }catch(error){
    sendError(response, error);
  }
};
