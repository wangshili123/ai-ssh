declare module '@ant-design/plots' {
  import { ReactNode } from 'react';

  interface LineConfig {
    data: any[];
    xField: string;
    yField: string;
    seriesField?: string;
    yAxis?: {
      label?: {
        formatter?: (v: string) => string;
      };
      min?: number;
      max?: number;
    };
    xAxis?: {
      type?: string;
    };
    tooltip?: {
      showMarkers?: boolean;
      formatter?: (datum: any) => {
        name: string;
        value: string;
      };
    };
    legend?: {
      position?: 'top' | 'bottom' | 'left' | 'right';
    };
    smooth?: boolean;
    animation?: {
      appear?: {
        animation?: string;
        duration?: number;
      };
    };
    point?: {
      size?: number;
      shape?: string;
      style?: {
        opacity?: number;
        stroke?: string;
        lineWidth?: number;
      };
    };
    state?: {
      active?: {
        style?: {
          shadowBlur?: number;
          stroke?: string;
          fill?: string;
        };
      };
    };
    theme?: {
      geometries?: {
        line?: {
          line?: {
            style?: {
              lineWidth?: number;
            };
          };
        };
      };
    };
  }

  interface DualAxesConfig {
    data: any[][];
    xField: string;
    yField: [string, string];
    yAxis?: {
      [key: string]: {
        min?: number;
        max?: number;
        label?: {
          formatter?: (v: string) => string;
        };
      };
    };
    geometryOptions?: Array<{
      geometry: string;
      color?: string;
      smooth?: boolean;
      label?: {
        formatter?: (v: any) => string;
      };
    }>;
    animation?: {
      appear?: {
        animation?: string;
        duration?: number;
      };
    };
    tooltip?: {
      shared?: boolean;
      showCrosshairs?: boolean;
      formatter?: (datum: any) => {
        name: string;
        value: string;
      };
    };
    legend?: {
      itemName?: {
        formatter?: (text: string) => string;
      };
    };
  }

  interface AreaConfig {
    data: any[];
    xField: string;
    yField: string;
    appendPadding?: number[];
    autoFit?: boolean;
    height?: number;
    animation?: boolean | object;
    xAxis?: boolean | object;
    yAxis?: boolean | object;
    tooltip?: boolean | object;
    line?: boolean | object;
    smooth?: boolean;
    areaStyle?: {
      fill?: string;
      fillOpacity?: number;
    };
    meta?: {
      [key: string]: {
        min?: number;
        max?: number;
      };
    };
  }

  interface TinyAreaConfig {
    data: number[];
    height?: number;
    autoFit?: boolean;
    smooth?: boolean;
    areaStyle?: {
      fill?: string;
      fillOpacity?: number;
    };
  }

  interface TinyLineConfig {
    data: number[];
    height?: number;
    autoFit?: boolean;
    smooth?: boolean;
    areaStyle?: {
      fill?: string;
      fillOpacity?: number;
    };
    lineStyle?: {
      stroke?: string;
      lineWidth?: number;
    };
    color?: string;
    padding?: number[];
  }

  export const Line: React.FC<LineConfig>;
  export const DualAxes: React.FC<DualAxesConfig>;
  export class Area extends React.Component<AreaConfig> {}
  export const TinyArea: React.FC<TinyAreaConfig>;
  export const TinyLine: React.FC<TinyLineConfig>;
} 