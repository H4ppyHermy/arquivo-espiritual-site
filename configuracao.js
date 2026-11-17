// Preencha com os dados de Project Settings > API no Supabase.
// Cole APENAS a chave publica anon/publishable. NUNCA a service_role ou secret.
window.ARQUIVO_ONLINE_CONFIG = {
  url: "https://cxoqifiewqtxsvylfhco.supabase.co",
  anonKey: "sb_publishable_xyUG_qTGBhAnNrKBpphLTw_fu5i6wkg",
  // STUN público. Para redes restritas, acrescente um TURN com credenciais válidas.
  // NÃO publique senhas TURN permanentes em repositórios públicos.
  // Ative somente depois de configurar DISCORD_BOT_TOKEN, canal e CORS na Edge Function.
  discordNotifications: false,
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};
