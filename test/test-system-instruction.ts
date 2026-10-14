import { GoogleGenAI } from '@google/genai';

async function run() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return;
  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const interaction = await (ai as any).interactions.create({
      model: 'gemini-3.5-flash',
      input: 'Who are you?',
      config: {
        systemInstruction: 'You are a helpful assistant named Antigravity SJA QA Engineer.'
      }
    });
    console.log('Result with config.systemInstruction:', interaction.outputText);
  } catch (err: any) {
    console.log('Failed with config.systemInstruction:', err.message || err);
  }

  try {
    const interaction = await (ai as any).interactions.create({
      model: 'gemini-3.5-flash',
      input: 'Who are you?',
      systemInstruction: 'You are a helpful assistant named Antigravity SJA QA Engineer.'
    });
    console.log('Result with top-level systemInstruction:', interaction.outputText);
  } catch (err: any) {
    console.log('Failed with top-level systemInstruction:', err.message || err);
  }
}

run();
