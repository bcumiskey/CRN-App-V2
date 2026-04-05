import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  Dimensions,
  Alert,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { usePropertyPhotos, PropertyPhoto } from "../../../../../hooks/use-property-profile";
import { useProperty } from "../../../../../hooks/use-properties";
import { Button } from "../../../../../components/ui/Button";
import { EmptyState } from "../../../../../components/ui/EmptyState";

const SCREEN_WIDTH = Dimensions.get("window").width;
const COLUMN_COUNT = 3;
const GAP = 4;
const THUMB_SIZE = (SCREEN_WIDTH - 32 - GAP * (COLUMN_COUNT - 1)) / COLUMN_COUNT;

type PhotoType = "all" | "reference" | "setup" | "damage" | "general";

export default function PhotoGalleryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const photosQuery = usePropertyPhotos(id);
  const propertyQuery = useProperty(id);

  const [selectedType, setSelectedType] = useState<PhotoType>("all");
  const [selectedRoom, setSelectedRoom] = useState<string>("all");
  const [viewingPhoto, setViewingPhoto] = useState<PropertyPhoto | null>(null);

  const photos = photosQuery.data ?? [];
  const rooms = propertyQuery.data?.rooms ?? [];

  // Filter photos
  const filtered = photos.filter((p) => {
    if (selectedType !== "all" && p.photoType !== selectedType) return false;
    if (selectedRoom !== "all" && p.roomId !== selectedRoom) return false;
    return true;
  });

  // Unique room names for filter
  const roomOptions = [
    { id: "all", name: "All Rooms" },
    ...rooms.map((r) => ({ id: r.id, name: r.name })),
  ];

  const typeFilters: { key: PhotoType; label: string }[] = [
    { key: "all", label: "All" },
    { key: "reference", label: "Reference" },
    { key: "setup", label: "Setup" },
    { key: "damage", label: "Damage" },
  ];

  if (photosQuery.isLoading) {
    return (
      <View style={styles.loading}>
        <Text>Loading photos...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Filters */}
      <View style={styles.filterBar}>
        {/* Room dropdown-style selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.roomScroll}
        >
          {roomOptions.map((room) => (
            <TouchableOpacity
              key={room.id}
              onPress={() => setSelectedRoom(room.id)}
              style={[
                styles.roomChip,
                selectedRoom === room.id && styles.roomChipActive,
              ]}
            >
              <Text
                style={[
                  styles.roomChipText,
                  selectedRoom === room.id && styles.roomChipTextActive,
                ]}
              >
                {room.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Type pills */}
        <View style={styles.typePills}>
          {typeFilters.map((t) => (
            <TouchableOpacity
              key={t.key}
              onPress={() => setSelectedType(t.key)}
              style={[
                styles.pill,
                selectedType === t.key && styles.pillActive,
              ]}
            >
              <Text
                style={[
                  styles.pillText,
                  selectedType === t.key && styles.pillTextActive,
                ]}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Photo Grid or Empty State */}
      {filtered.length === 0 ? (
        <EmptyState
          title="No Photos"
          message={
            photos.length === 0
              ? "Add photos to document this property's setup and condition."
              : "No photos match the current filters."
          }
          actionLabel="+ Add Photo"
          onAction={() =>
            Alert.alert(
              "Coming Soon",
              "Photo upload will be available in Phase 8."
            )
          }
        />
      ) : (
        <ScrollView contentContainerStyle={styles.grid}>
          {filtered.map((photo) => (
            <TouchableOpacity
              key={photo.id}
              onPress={() => setViewingPhoto(photo)}
              activeOpacity={0.8}
            >
              <View style={styles.thumbContainer}>
                <Image
                  source={{ uri: photo.thumbnailUrl ?? photo.url }}
                  style={styles.thumbnail}
                />
                {photo.isPrimary && (
                  <View style={styles.starBadge}>
                    <Text style={styles.starIcon}>{"\u2B50"}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Add Photo Button */}
      <View style={styles.addButtonContainer}>
        <Button
          onPress={() =>
            Alert.alert(
              "Coming Soon",
              "Photo upload will be available in Phase 8."
            )
          }
          variant="primary"
          fullWidth
        >
          + Add Photo
        </Button>
      </View>

      {/* Full-size Viewer Modal */}
      <Modal
        visible={!!viewingPhoto}
        animationType="fade"
        transparent
        onRequestClose={() => setViewingPhoto(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalClose}
            onPress={() => setViewingPhoto(null)}
          >
            <Text style={styles.modalCloseText}>X</Text>
          </TouchableOpacity>

          {viewingPhoto && (
            <View style={styles.modalContent}>
              <Image
                source={{ uri: viewingPhoto.url }}
                style={styles.fullImage}
                resizeMode="contain"
              />
              {viewingPhoto.caption && (
                <Text style={styles.caption}>{viewingPhoto.caption}</Text>
              )}
              <View style={styles.photoMeta}>
                <Text style={styles.photoMetaText}>
                  {viewingPhoto.photoType.charAt(0).toUpperCase() +
                    viewingPhoto.photoType.slice(1)}
                </Text>
                {viewingPhoto.roomName && (
                  <Text style={styles.photoMetaText}>
                    {" "}
                    {"\u2022"} {viewingPhoto.roomName}
                  </Text>
                )}
                {viewingPhoto.isPrimary && (
                  <Text style={styles.photoMetaText}>
                    {" "}
                    {"\u2022"} Primary
                  </Text>
                )}
              </View>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  filterBar: { padding: 16, paddingBottom: 8, backgroundColor: "#ffffff", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  roomScroll: { marginBottom: 8 },
  roomChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#f3f4f6",
    marginRight: 8,
  },
  roomChipActive: { backgroundColor: "#2563eb" },
  roomChipText: { fontSize: 13, color: "#6b7280", fontWeight: "500" },
  roomChipTextActive: { color: "#ffffff" },
  typePills: { flexDirection: "row", gap: 8 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#f3f4f6",
  },
  pillActive: { backgroundColor: "#2563eb" },
  pillText: { fontSize: 13, color: "#6b7280", fontWeight: "500" },
  pillTextActive: { color: "#ffffff" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 16,
    gap: GAP,
  },
  thumbContainer: { position: "relative" },
  thumbnail: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 8,
    backgroundColor: "#e5e7eb",
  },
  starBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  starIcon: { fontSize: 12 },
  addButtonContainer: { padding: 16, backgroundColor: "#ffffff", borderTopWidth: 1, borderTopColor: "#e5e7eb" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.9)", justifyContent: "center", alignItems: "center" },
  modalClose: { position: "absolute", top: 60, right: 20, zIndex: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  modalCloseText: { color: "#ffffff", fontSize: 16, fontWeight: "600" },
  modalContent: { alignItems: "center", paddingHorizontal: 16 },
  fullImage: { width: SCREEN_WIDTH - 32, height: SCREEN_WIDTH - 32 },
  caption: { color: "#ffffff", fontSize: 15, marginTop: 12, textAlign: "center" },
  photoMeta: { flexDirection: "row", marginTop: 8 },
  photoMetaText: { color: "#9ca3af", fontSize: 13 },
});
