import { AdMob, RewardAdOptions, AdMobRewardItem } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

const REWARDED_AD_ID = 'ca-app-pub-3940256099942544/5224354917';

export const isNative = () => Capacitor.isNativePlatform();

export const initializeAdMob = async () => {
  if (isNative()) {
    try {
      await AdMob.initialize({});
    } catch (e) {
      console.error('AdMob initialization failed', e);
    }
  }
};

export const showRewardedAd = async (onReward: () => void, onFail: () => void) => {
  if (isNative()) {
    try {
      const options: RewardAdOptions = {
        adId: REWARDED_AD_ID,
      };
      await AdMob.prepareRewardVideoAd(options);
      const reward = await AdMob.showRewardVideoAd();
      if (reward) {
        onReward();
      } else {
        onFail();
      }
    } catch (e) {
      console.error('AdMob Reward Video failed', e);
      onFail();
    }
  } else {
    // Web Simulation: Handled in the UI component for the 3s delay
    onReward();
  }
};
