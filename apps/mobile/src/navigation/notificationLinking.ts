import { Linking } from "react-native";

import {
  getLastNotificationResponseUrl,
  subscribeNotificationResponseUrls,
} from "../services/notifications";
import {
  buildGroupBuyNotificationUrl,
  parseGroupBuyNotificationUrl,
} from "../services/notificationPayload";

type UrlListener = (url: string) => void;
type NotificationLinkingDependencies = {
  getInitialLinkingUrl(): Promise<string | null>;
  getLastNotificationUrl(): Promise<string | null>;
  subscribeLinkingUrls(listener: UrlListener): () => void;
  subscribeNotificationUrls(listener: UrlListener): () => void;
};

function canonicalizeUrl(value: string | null) {
  const groupBuyId = parseGroupBuyNotificationUrl(value);
  return groupBuyId ? buildGroupBuyNotificationUrl(groupBuyId) : null;
}

const defaultDependencies: NotificationLinkingDependencies = {
  getInitialLinkingUrl: () => Linking.getInitialURL(),
  getLastNotificationUrl: getLastNotificationResponseUrl,
  subscribeLinkingUrls: (listener) => {
    const subscription = Linking.addEventListener("url", ({ url }) => {
      const canonical = canonicalizeUrl(url);
      if (canonical) listener(canonical);
    });
    return () => subscription.remove();
  },
  subscribeNotificationUrls: subscribeNotificationResponseUrls,
};

export function createNotificationLinking(
  dependencies: NotificationLinkingDependencies = defaultDependencies,
) {
  return {
    prefixes: ["gongguwish://"],
    config: {
      screens: {
        Detail: "group-buy/:groupBuyId",
      },
    },
    async getInitialURL() {
      const initialUrl = canonicalizeUrl(
        await dependencies.getInitialLinkingUrl(),
      );
      if (initialUrl) return initialUrl;
      return canonicalizeUrl(await dependencies.getLastNotificationUrl());
    },
    subscribe(listener: UrlListener) {
      const removeLinking = dependencies.subscribeLinkingUrls((url) => {
        const canonical = canonicalizeUrl(url);
        if (canonical) listener(canonical);
      });
      const removeNotifications = dependencies.subscribeNotificationUrls(
        (url) => {
          const canonical = canonicalizeUrl(url);
          if (canonical) listener(canonical);
        },
      );
      return () => {
        removeLinking();
        removeNotifications();
      };
    },
  };
}

export const notificationLinking = createNotificationLinking();
