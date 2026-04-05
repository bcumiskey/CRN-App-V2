import { useState, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
  StatusBar,
  FlatList,
  Pressable,
} from "react-native";

interface ImageItem {
  uri: string;
  caption?: string;
}

interface ImageViewerProps {
  images: ImageItem[];
  initialIndex?: number;
  visible: boolean;
  onClose: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

/**
 * Full-screen image viewer with swipe navigation.
 *
 * Usage:
 *   const [viewerVisible, setViewerVisible] = useState(false);
 *   const [viewerIndex, setViewerIndex] = useState(0);
 *
 *   <TouchableOpacity onPress={() => { setViewerIndex(i); setViewerVisible(true); }}>
 *     <Image source={{ uri: photo.url }} style={styles.thumbnail} />
 *   </TouchableOpacity>
 *
 *   <ImageViewer
 *     images={photos.map(p => ({ uri: p.url, caption: p.caption }))}
 *     initialIndex={viewerIndex}
 *     visible={viewerVisible}
 *     onClose={() => setViewerVisible(false)}
 *   />
 */
export function ImageViewer({ images, initialIndex = 0, visible, onClose }: ImageViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
    []
  );

  if (!visible || images.length === 0) return null;

  const currentImage = images[currentIndex];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <View style={styles.container}>
        {/* Close button */}
        <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>

        {/* Image counter */}
        {images.length > 1 && (
          <View style={styles.counter}>
            <Text style={styles.counterText}>
              {currentIndex + 1} / {images.length}
            </Text>
          </View>
        )}

        {/* Image carousel */}
        <FlatList
          data={images}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
          keyExtractor={(_, index) => String(index)}
          renderItem={({ item }) => (
            <Pressable style={styles.imageWrapper} onPress={onClose}>
              <Image
                source={{ uri: item.uri }}
                style={styles.image}
                resizeMode="contain"
              />
            </Pressable>
          )}
        />

        {/* Caption */}
        {currentImage?.caption && (
          <View style={styles.captionBar}>
            <Text style={styles.captionText}>{currentImage.caption}</Text>
          </View>
        )}

        {/* Dots indicator */}
        {images.length > 1 && images.length <= 10 && (
          <View style={styles.dotsContainer}>
            {images.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === currentIndex && styles.dotActive]}
              />
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}

/**
 * Thumbnail grid component that opens the viewer on tap.
 * Convenience wrapper for common use case.
 */
interface ThumbnailGridProps {
  images: ImageItem[];
  columns?: number;
  thumbnailSize?: number;
}

export function ThumbnailGrid({ images, columns = 3, thumbnailSize }: ThumbnailGridProps) {
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const size = thumbnailSize ?? (SCREEN_WIDTH - 32 - (columns - 1) * 8) / columns;

  return (
    <>
      <View style={styles.grid}>
        {images.map((img, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => {
              setViewerIndex(i);
              setViewerVisible(true);
            }}
            activeOpacity={0.8}
          >
            <Image
              source={{ uri: img.uri }}
              style={[styles.thumbnail, { width: size, height: size }]}
            />
            {img.caption && (
              <Text style={styles.thumbCaption} numberOfLines={1}>
                {img.caption}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <ImageViewer
        images={images}
        initialIndex={viewerIndex}
        visible={viewerVisible}
        onClose={() => setViewerVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
    justifyContent: "center",
  },
  closeButton: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
  },
  counter: {
    position: "absolute",
    top: 56,
    left: 20,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  counterText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "500",
  },
  imageWrapper: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.75,
  },
  captionBar: {
    position: "absolute",
    bottom: 80,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  captionText: {
    color: "#ffffff",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  dotsContainer: {
    position: "absolute",
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  dotActive: {
    backgroundColor: "#ffffff",
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  // Thumbnail grid
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  thumbnail: {
    borderRadius: 8,
    backgroundColor: "#e5e7eb",
  },
  thumbCaption: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 2,
    maxWidth: 100,
  },
});
