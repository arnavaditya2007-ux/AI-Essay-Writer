module.exports = async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { messages, max_tokens } = req.body;

    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Invalid request body' });
    }

    try {
        let response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`
            },
            body: JSON.stringify({
                model: process.env.MODEL_ID || 'google/gemini-2.5-flash',
                max_tokens: max_tokens || 8192,
                messages
            })
        });

        let data = await response.json();

        // If the account has insufficient balance (HTTP 402), attempt to use a free model fallback
        if (response.status === 402) {
            console.log("Detecting 402 Payment Required. Trying free model fallback...");
            const fallbackModels = [
                'google/gemini-2.0-flash-thinking-exp:free',
                'google/gemma-2-9b-it:free',
                'meta-llama/llama-3-8b-instruct:free',
                'openrouter/free'
            ];

            for (const fallbackModel of fallbackModels) {
                try {
                    const fallbackResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`
                        },
                        body: JSON.stringify({
                            model: fallbackModel,
                            max_tokens: max_tokens || 8192,
                            messages
                        })
                    });

                    const fallbackData = await fallbackResponse.json();
                    if (fallbackResponse.ok) {
                        return res.status(200).json(fallbackData);
                    } else {
                        console.error(`Fallback to ${fallbackModel} failed:`, fallbackData);
                    }
                } catch (fallbackErr) {
                    console.error(`Error during fallback to ${fallbackModel}:`, fallbackErr);
                }
            }
        }

        if (!response.ok) {
            return res.status(response.status).json({ error: data?.error?.message || 'API error' });
        }

        return res.status(200).json(data);
    } catch (err) {
        console.error('Proxy error:', err);
        return res.status(500).json({ error: 'Internal server error: ' + err.message });
    }
};
