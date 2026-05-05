/**
 * Offload -- Navigation Type Definitions
 */

export type RootStackParamList = {
  Onboarding: undefined;
  Main: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Search: undefined;
  Settings: undefined;
};

export type HomeStackParamList = {
  HomeList: undefined;
  ItemDetail: { item: StoredItem };
};

export interface StoredItem {
  id: string;
  content_type: 'text' | 'link' | 'image';
  raw_content: string;
  preview_text: string;
  description?: string | null;
  thumbnail_path?: string | null;
  source_name?: string | null;
  is_embedded: number;
  created_at: number;
}
