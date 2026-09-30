module.exports = (request, response)=>{
  if(request.method !== 'GET'){
    response.setHeader('Allow', 'GET');
    response.status(405).json({error:'Method tidak diizinkan.'});
    return;
  }
  response.status(200).json({
    provider:'Gemini',
    configured:Boolean(process.env.GEMINI_API_KEY),
    setupMessage:process.env.GEMINI_API_KEY
      ? null
      : 'Tambahkan GEMINI_API_KEY di Vercel: Project Settings → Environment Variables, lalu redeploy.'
  });
};
