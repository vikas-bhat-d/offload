declare module 'react-native-share-menu' {
  export interface SharedItem {
    mimeType: string;
    data: string | string[];
    extraData?: Record<string, any>;
  }

  type ShareCallback = (item: SharedItem | null) => void;

  interface Subscription {
    remove(): void;
  }

  const ShareMenu: {
    getInitialShare(callback: ShareCallback): void;
    addNewShareListener(callback: ShareCallback): Subscription;
    getSharedText(callback: ShareCallback): void;
  };

  export default ShareMenu;
}
