import { AdMob, RewardAdOptions, AdMobRewardItem } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

const REWARDED_AD_ID = import.meta.env.VITE_ADMOB_REWARDED_ID || 'ca-app-pub-3940256099942544/5224354917';

export const isNative = () => Capacitor.isNativePlatform();

export const initializeAdMob = async () => {
  if (isNative()) {
    try {
      await AdMob.initialize({
        // Optional: Add testing devices if needed
        // testingDevices: ['...'],
        // initializeForTesting: true,
      });
      console.log('AdMob initialized successfully');
    } catch (e) {
      console.error('AdMob initialization failed', e);
    }
  }
};

export const showRewardedAd = async (onReward: () => void, onFail: () => void) => {
  if (isNative()) {
    try {
      // 1. Prepare the ad
      await AdMob.prepareRewardVideoAd({
        adId: REWARDED_AD_ID,
      });

      // 2. Show the ad
      const reward = await AdMob.showRewardVideoAd();
      
      if (reward && reward.amount > 0) {
        console.log('User rewarded:', reward);
        onReward();
      } else {
        // If the user closed the ad early or there was no reward item
        console.log('Ad closed without reward or failed to show');
        onFail();
      }
    } catch (e) {
      console.error('AdMob Reward Video failed', e);
      onFail();
    }
  } else {
    // Web Simulation: Handled in the UI component for the 3s delay
    // This allows testing the flow in the browser
    setTimeout(() => {
      onReward();
    }, 3000);
  }
};
