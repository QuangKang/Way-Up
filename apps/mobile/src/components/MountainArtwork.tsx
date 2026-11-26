import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export const SNOWY_ROCK_HOLD_WIDTH = 112;
export const SNOWY_ROCK_HOLD_HEIGHT = 38;

export const SNOWY_ICE_HOLD_WIDTH = 82;
export const SNOWY_ICE_HOLD_HEIGHT = 42;

export interface SnowyRockHoldProps {
  width?: number;
  isTarget?: boolean;
  rockMainColor?: string;
  rockLightColor?: string;
  rockDarkColor?: string;
}

/**
 * Wide inverted-triangle dark-slate rock crag topped with a crisp white snow cap.
 * Built with pure React Native Views and CSS border triangles (zero native SVG deps).
 */
export const SnowyRockHold: React.FC<SnowyRockHoldProps> = ({
  width = SNOWY_ROCK_HOLD_WIDTH,
  isTarget = false,
  rockMainColor = '#3B495E',
  rockLightColor = '#556987',
  rockDarkColor = '#1E293B'
}) => {
  const halfW = Math.round(width / 2);
  const triHeight = Math.max(18, Math.round(width * 0.25));
  const snowHeight = Math.max(7, Math.round(width * 0.085));

  return (
    <View style={[styles.holdContainer, { width }]}>
      {/* Crisp White Snow Cap + Scalloped Overhangs */}
      <View
        style={[
          styles.snowCapWide,
          {
            width,
            height: snowHeight,
            borderColor: isTarget ? '#38BDF8' : '#E2E8F0'
          }
        ]}
      >
        <View style={styles.snowHighlightLine} />
      </View>

      <View style={[styles.snowDripRow, { width: width - 12 }]}>
        <View style={styles.snowDrip} />
        <View style={[styles.snowDrip, styles.snowDripMid]} />
        <View style={styles.snowDrip} />
      </View>

      {/* Inverted-Triangle Layered Rock Crag */}
      <View style={styles.triangleWrap}>
        {/* Main Slate Crag */}
        <View
          style={[
            styles.triangleBase,
            {
              borderLeftWidth: halfW - 3,
              borderRightWidth: halfW - 3,
              borderTopWidth: triHeight,
              borderTopColor: rockMainColor
            }
          ]}
        />
        {/* Left Lit Stone Facet */}
        <View
          style={[
            styles.triangleBase,
            styles.triangleOverlay,
            {
              left: 4,
              borderLeftWidth: Math.round(halfW * 0.56),
              borderRightWidth: Math.round(halfW * 0.24),
              borderTopWidth: Math.round(triHeight * 0.78),
              borderTopColor: rockLightColor
            }
          ]}
        />
        {/* Right Deep Shadow Facet */}
        <View
          style={[
            styles.triangleBase,
            styles.triangleOverlay,
            {
              right: 4,
              borderLeftWidth: Math.round(halfW * 0.2),
              borderRightWidth: Math.round(halfW * 0.54),
              borderTopWidth: Math.round(triHeight * 0.76),
              borderTopColor: rockDarkColor
            }
          ]}
        />
      </View>
    </View>
  );
};

export interface SnowyIceHoldProps {
  width?: number;
  isTarget?: boolean;
  slipProgress?: number; // [0..1] when local climber is standing on this hold
}

/**
 * Narrower inverted-triangle glacial-cyan icy rock hold with crisp white snow cap,
 * crystalline glint facets, mini icicles, and optional 0.75s grip-slip bar.
 */
export const SnowyIceHold: React.FC<SnowyIceHoldProps> = ({
  width = SNOWY_ICE_HOLD_WIDTH,
  isTarget = false,
  slipProgress = 0
}) => {
  const halfW = Math.round(width / 2);
  const triHeight = Math.max(20, Math.round(width * 0.37));
  const snowHeight = Math.max(7, Math.round(width * 0.095));
  const clampedSlip = Math.max(0, Math.min(1, slipProgress));

  return (
    <View style={[styles.holdContainer, { width }]}>
      {/* Snow Cap with Frosty Cyan Rim */}
      <View
        style={[
          styles.snowCapIce,
          {
            width,
            height: snowHeight,
            borderColor: isTarget ? '#7DD3FC' : '#BAE6FD'
          }
        ]}
      />

      {/* Narrower Inverted-Triangle Translucent Ice Body */}
      <View style={styles.triangleWrap}>
        {/* Outer Glacial Cyan Cone */}
        <View
          style={[
            styles.triangleBase,
            {
              borderLeftWidth: halfW - 3,
              borderRightWidth: halfW - 3,
              borderTopWidth: triHeight,
              borderTopColor: '#0284C7',
              opacity: 0.92
            }
          ]}
        />
        {/* Mid Bright Ice Facet */}
        <View
          style={[
            styles.triangleBase,
            styles.triangleOverlay,
            {
              left: 4,
              borderLeftWidth: Math.round(halfW * 0.52),
              borderRightWidth: Math.round(halfW * 0.26),
              borderTopWidth: Math.round(triHeight * 0.76),
              borderTopColor: '#38BDF8'
            }
          ]}
        />
        {/* Crystalline Specular Glint */}
        <View
          style={[
            styles.triangleBase,
            styles.triangleOverlay,
            {
              left: Math.round(halfW * 0.36),
              borderLeftWidth: Math.round(halfW * 0.22),
              borderRightWidth: Math.round(halfW * 0.14),
              borderTopWidth: Math.round(triHeight * 0.52),
              borderTopColor: '#E0F2FE'
            }
          ]}
        />
        {/* Side Mini Icicle Glints */}
        <View
          style={[
            styles.triangleBase,
            styles.icicleLeft,
            {
              borderLeftWidth: 3.5,
              borderRightWidth: 3.5,
              borderTopWidth: 10,
              borderTopColor: '#BAE6FD'
            }
          ]}
        />
        <View
          style={[
            styles.triangleBase,
            styles.icicleRight,
            {
              borderLeftWidth: 3.5,
              borderRightWidth: 3.5,
              borderTopWidth: 12,
              borderTopColor: '#E0F2FE'
            }
          ]}
        />
      </View>

      {/* Live 0.75s Slip-Grip Countdown Bar */}
      {clampedSlip > 0 && (
        <View style={[styles.slipBarTrack, { width: width - 8 }]}>
          <View
            style={[
              styles.slipBarFill,
              {
                width: `${Math.round(clampedSlip * 100)}%`,
                backgroundColor: clampedSlip > 0.68 ? '#EF4444' : '#FDE047'
              }
            ]}
          />
        </View>
      )}
    </View>
  );
};

export interface BoulderSpriteProps {
  size?: number;
  spinDeg?: string;
}

/**
 * Faceted tumbling mountain boulder built from pure React Native Views.
 */
export const BoulderSprite: React.FC<BoulderSpriteProps> = ({
  size = 48,
  spinDeg = '0deg'
}) => {
  const radius = Math.round(size * 0.34);
  return (
    <View
      style={[
        styles.boulderBody,
        {
          width: size,
          height: size,
          borderRadius: radius,
          transform: [{ rotate: spinDeg }]
        }
      ]}
    >
      <View
        style={[
          styles.boulderFacetLight,
          {
            width: Math.round(size * 0.38),
            height: Math.round(size * 0.26)
          }
        ]}
      />
      <View
        style={[
          styles.boulderFacetDark,
          {
            width: Math.round(size * 0.3),
            height: Math.round(size * 0.3)
          }
        ]}
      />
      <View style={styles.boulderSnowDust} />
    </View>
  );
};

/**
 * Miniature rendered preview of Falling Boulder + Top Lane Warning for the Book modal.
 */
export const FallingBoulderMiniature: React.FC = () => {
  return (
    <View style={styles.hazardMiniBox}>
      <View style={styles.miniRockWarnPill}>
        <Text style={styles.miniRockWarnText}>⚠ ROCK</Text>
      </View>
      <BoulderSprite size={30} spinDeg="22deg" />
    </View>
  );
};

/**
 * Miniature rendered preview of Summit Blizzard Gust whiteout for the Book modal.
 */
export const BlizzardGustMiniature: React.FC = () => {
  return (
    <View style={styles.blizzardMiniBox}>
      <View style={styles.blizzardMiniVeil} />
      <View
        style={[styles.blizzardMiniStreak, { top: 12, left: 8, width: 32 }]}
      />
      <View
        style={[styles.blizzardMiniStreak, { top: 23, left: 26, width: 38 }]}
      />
      <View
        style={[styles.blizzardMiniStreak, { top: 35, left: 12, width: 28 }]}
      />
      <View style={[styles.blizzardMiniFlake, { top: 16, right: 14 }]} />
      <View style={[styles.blizzardMiniFlake, { bottom: 11, left: 20 }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  holdContainer: {
    alignItems: 'center'
  },
  snowCapWide: {
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    borderWidth: 1.5,
    justifyContent: 'flex-start',
    overflow: 'hidden',
    zIndex: 3
  },
  snowHighlightLine: {
    height: 2,
    backgroundColor: '#FFFFFF',
    opacity: 0.9
  },
  snowDripRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: -2,
    zIndex: 4
  },
  snowDrip: {
    width: 12,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4
  },
  snowDripMid: {
    width: 16,
    height: 5,
    backgroundColor: '#F1F5F9'
  },
  snowCapIce: {
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    borderWidth: 1.5,
    zIndex: 3
  },
  triangleWrap: {
    marginTop: -2,
    alignItems: 'center',
    justifyContent: 'flex-start',
    position: 'relative'
  },
  triangleBase: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent'
  },
  triangleOverlay: {
    position: 'absolute',
    top: 0
  },
  icicleLeft: {
    position: 'absolute',
    top: 0,
    left: 6
  },
  icicleRight: {
    position: 'absolute',
    top: 0,
    right: 7
  },
  slipBarTrack: {
    position: 'absolute',
    top: 2,
    height: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    borderRadius: 2,
    overflow: 'hidden',
    zIndex: 6
  },
  slipBarFill: {
    height: '100%'
  },
  boulderBody: {
    backgroundColor: '#57534E',
    borderWidth: 2.5,
    borderColor: '#1C1917',
    borderBottomWidth: 5,
    borderBottomColor: '#292524',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  boulderFacetLight: {
    position: 'absolute',
    top: 4,
    left: 5,
    borderRadius: 5,
    backgroundColor: '#A8A29E'
  },
  boulderFacetDark: {
    position: 'absolute',
    bottom: 4,
    right: 5,
    borderRadius: 4,
    backgroundColor: '#44403C'
  },
  boulderSnowDust: {
    position: 'absolute',
    top: 2,
    right: 7,
    width: 8,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    opacity: 0.75
  },
  hazardMiniBox: {
    width: 76,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#0B1424',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5
  },
  miniRockWarnPill: {
    backgroundColor: '#991B1B',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#FCA5A5'
  },
  miniRockWarnText: {
    color: '#FEF08A',
    fontSize: 8,
    fontWeight: '900'
  },
  blizzardMiniBox: {
    width: 76,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#0C213D',
    borderWidth: 1,
    borderColor: '#7DD3FC',
    overflow: 'hidden',
    position: 'relative'
  },
  blizzardMiniVeil: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(224, 242, 254, 0.36)'
  },
  blizzardMiniStreak: {
    position: 'absolute',
    height: 2.5,
    borderRadius: 2,
    backgroundColor: '#F8FAFC',
    transform: [{ rotate: '10deg' }]
  },
  blizzardMiniFlake: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
    opacity: 0.85
  }
});
