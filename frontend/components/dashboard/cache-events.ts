"use client";

export const recommendationCacheClearedEvent =
  "finora:recommendation-cache-cleared";

export function notifyRecommendationCacheCleared() {
  window.dispatchEvent(new Event(recommendationCacheClearedEvent));
}
