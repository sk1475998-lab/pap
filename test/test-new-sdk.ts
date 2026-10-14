import { GoogleGenAI } from '@google/genai';

async function run() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log('Testing interactions with API Key:', apiKey ? apiKey.slice(0, 15) + '...' : 'undefined');
  if (!apiKey) return;

  const ai = new GoogleGenAI({ apiKey });
  try {
    const interaction = await (ai as any).interactions.create({
      model: 'gemini-3.5-flash',
      input: 'Explain how AI works in a few words',
    });
    console.log('Interaction status:', interaction.status);
    console.log('Output text:', interaction.outputText);
    console.log('Full interaction:', JSON.stringify(interaction, null, 2));
  } catch (err: any) {
    console.error('Error details:', err);
  }
}

run();
