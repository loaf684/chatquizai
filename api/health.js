module.exports = (request, response)=>{
  if(request.method !== 'GET'){
    response.setHeader('Allow', 'GET');
    response.status(405).json({error:'Method tidak diizinkan.'});
    return;
  }
  response.status(200).json({configured:Boolean(process.env.OPENAI_API_KEY)});
};
