import { AdMob, RewardAdOptions } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

/**
 * Inicializa o AdMob, prepara e exibe um vídeo premiado.
 * Retorna true se o usuário assistiu até o final e recebeu a recompensa.
 */
export const exibirVideoRecompensa = async (): Promise<boolean> => {
  // Se não estiver em plataforma nativa (Android/iOS), simula o comportamento
  if (!Capacitor.isNativePlatform()) {
    console.log('Simulando vídeo premiado no navegador...');
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(true);
      }, 3000);
    });
  }

  try {
    // Inicializa o AdMob (pode ser chamado múltiplas vezes com segurança)
    await AdMob.initialize();

    const options: RewardAdOptions = {
      adId: 'ca-app-pub-3940256099942544/5224354917',
    };

    // Prepara o anúncio
    await AdMob.prepareRewardVideoAd(options);

    // Exibe o anúncio e aguarda o resultado
    const reward = await AdMob.showRewardVideoAd();

    // Retorna true se houver um item de recompensa com valor maior que 0
    return !!(reward && reward.amount > 0);
  } catch (error) {
    console.error('Erro ao processar anúncio AdMob:', error);
    return false;
  }
};
