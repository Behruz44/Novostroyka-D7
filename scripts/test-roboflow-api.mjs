// Step 1: Test Roboflow API with POST + base64
async function tryModel(modelId, b64, apiKey) {
  const url = `https://serverless.roboflow.com/${modelId}?api_key=${apiKey}&confidence=0.4`;
  console.log(`\nPOST to: ${url.replace(apiKey, '***')}`);
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35000);
  
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: b64,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    console.log('Status:', resp.status);
    const text = await resp.text();
    console.log('Response:', text.substring(0, 2000));
    
    if (resp.ok) {
      const data = JSON.parse(text);
      if (data.predictions && Array.isArray(data.predictions)) {
        console.log('\n=== Detections ===');
        console.log('Count:', data.predictions.length);
        data.predictions.forEach((p, i) => {
          console.log(`  [${i}] class=${p.class} confidence=${(p.confidence*100).toFixed(1)}% x=${p.x} y=${p.y} w=${p.width} h=${p.height}`);
        });
        if (data.image) console.log('Image dims:', JSON.stringify(data.image));
      }
      return data;
    }
  } catch (e) {
    clearTimeout(timeout);
    if (e.name === 'AbortError') console.log('TIMEOUT after 35s');
    else console.error('Error:', e.message);
  }
  return null;
}

async function main() {
  const API_KEY = 'XUqWJrC2hGfVuYbK1qRB';
  
  // Download test image
  console.log('Downloading test image...');
  const imgResp = await fetch('https://media.roboflow.com/inference/people-walking.jpg');
  const imgBuf = Buffer.from(await imgResp.arrayBuffer());
  const b64 = imgBuf.toString('base64');
  console.log('Image size:', imgBuf.length, 'bytes');
  
  // Try different model IDs
  const models = ['rfdetr-small', 'rfdetr-nano', 'yolov11n-640', 'coco/40'];
  for (const m of models) {
    console.log('\n' + '='.repeat(50));
    const result = await tryModel(m, b64, API_KEY);
    if (result && result.predictions) {
      console.log('\n*** SUCCESS with model:', m, '***');
      break;
    }
  }
}
main().catch(e => { console.error(e); process.exit(1); });
