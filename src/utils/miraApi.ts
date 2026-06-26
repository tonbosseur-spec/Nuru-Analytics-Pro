export async function callMiraDirect(
  storeState: any,
  systemInstruction: string,
  userMessage: string
): Promise<string> {
  const provider = storeState.miraApiProvider || 'gemini';
  const geminiApiKey = storeState.geminiApiKey || (import.meta as any).env?.VITE_GEMINI_API_KEY;
  const key = storeState.miraApiKey || geminiApiKey;

  if (provider === 'gemini') {
    if (!key) {
      throw new Error("Clé API Gemini introuvable. Veuillez renseigner votre clé dans les Paramètres.");
    }
    const modelName = storeState.miraApiModel || "gemini-1.5-flash";
    const directUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;
    
    const directRes = await fetch(directUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        },
        contents: [
          { role: 'user', parts: [{ text: userMessage }] }
        ]
      })
    });

    if (!directRes.ok) {
      const errData = await directRes.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `Erreur directe Google Gemini (HTTP ${directRes.status})`);
    }

    const resData = await directRes.json();
    const text = resData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("L'API Gemini n'a renvoyé aucun contenu.");
    }
    return text;
  } else if (provider === 'openai' || provider === 'deepseek' || provider === 'custom') {
    let keyToUse = key;
    if (provider === 'openai') keyToUse = storeState.openAiApiKey || key;
    if (provider === 'deepseek') keyToUse = storeState.deepSeekApiKey || key;
    
    if (!keyToUse && provider !== 'custom') {
      throw new Error(`La clé API pour ${provider} est requise dans les Paramètres.`);
    }

    let baseUrl = "https://api.openai.com/v1";
    if (provider === 'deepseek') {
      baseUrl = "https://api.deepseek.com/v1";
    } else if (provider === 'custom' && storeState.miraApiBaseUrl) {
      baseUrl = storeState.miraApiBaseUrl;
    }

    const model = storeState.miraApiModel || (provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini');
    const messages = [
      { role: "system", content: systemInstruction },
      { role: "user", content: userMessage }
    ];

    const directUrl = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (keyToUse) {
      headers["Authorization"] = `Bearer ${keyToUse}`;
    }

    const directRes = await fetch(directUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7
      })
    });

    if (!directRes.ok) {
      const errData = await directRes.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `Erreur directe ${provider} (HTTP ${directRes.status})`);
    }

    const resData = await directRes.json();
    return resData?.choices?.[0]?.message?.content || "";
  } else if (provider === 'anthropic') {
    const keyToUse = storeState.claudeApiKey || key;
    if (!keyToUse) {
      throw new Error("La clé API Anthropic (Claude) est requise dans les Paramètres.");
    }

    const model = storeState.miraApiModel || 'claude-3-5-sonnet-latest';
    
    // Anthropic direct API via browser often fails due to CORS, but let's try.
    const directRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": keyToUse,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: systemInstruction,
        messages: [
          { role: "user", content: userMessage }
        ]
      })
    });

    if (!directRes.ok) {
      const errData = await directRes.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `Erreur Anthropic (HTTP ${directRes.status})`);
    }

    const resData = await directRes.json();
    return resData?.content?.[0]?.text || "";
  }
  
  throw new Error("Fournisseur non supporté");
}
