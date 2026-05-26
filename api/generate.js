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
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ error: data?.error?.message || 'API error' });
        }

        return res.status(200).json(data);
    } catch (err) {
        console.error('Proxy error:', err);
        return res.status(500).json({ error: 'Internal server error: ' + err.message });
    }
};
