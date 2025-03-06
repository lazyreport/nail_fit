export interface Brand {
  id: number;
  name: string;
  website?: string;
  logo_url?: string;
  created_at: string;
}

export interface NailTipSet {
  id: number;
  brand_id: number;
  name: string;
  shape: string;
  length?: string;
  image_url?: string;
  created_at: string;
}

export interface NailTipSize {
  id: number;
  tip_set_id: number;
  size_label: string;
  length: number;
  width: number;
  inner_curve?: number;
  created_at: string;
}
