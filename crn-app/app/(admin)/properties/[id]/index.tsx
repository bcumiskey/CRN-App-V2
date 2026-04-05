import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useProperty, usePropertyNotes } from "../../../../hooks/use-properties";
import { Card } from "../../../../components/ui/Card";

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const propertyQuery = useProperty(id);
  const notesQuery = usePropertyNotes(id);

  const property = propertyQuery.data;
  const notes = notesQuery.data ?? [];

  if (!property) {
    return (
      <View style={styles.loading}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <Text style={styles.name}>{property.name}</Text>
      <Text style={styles.code}>{property.code}</Text>
      {property.address && <Text style={styles.address}>{property.address}</Text>}

      {/* Quick Info */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Info</Text>
        <InfoRow label="Default Fee" value={property.defaultJobFee ? `$${property.defaultJobFee.toFixed(2)}` : "Not set"} />
        <InfoRow label="House Cut" value={`${property.houseCutPercent}%`} />
        {property.owner && <InfoRow label="Owner" value={property.owner.name} />}
      </Card>

      {/* Access Info */}
      {(property.accessInstructions || property.parkingNotes || property.wifiName) && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Access & Info</Text>
          {property.accessInstructions && (
            <InfoRow label="Access" value={property.accessInstructions} />
          )}
          {property.parkingNotes && (
            <InfoRow label="Parking" value={property.parkingNotes} />
          )}
          {property.wifiName && (
            <InfoRow label="WiFi" value={`${property.wifiName}${property.wifiPassword ? ` / ${property.wifiPassword}` : ""}`} />
          )}
          {property.trashDay && (
            <InfoRow label="Trash Day" value={property.trashDay} />
          )}
        </Card>
      )}

      {/* Special Instructions */}
      {property.specialInstructions && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Special Instructions</Text>
          <Text style={styles.instructionText}>{property.specialInstructions}</Text>
        </Card>
      )}

      {/* Rooms */}
      {property.rooms && property.rooms.length > 0 && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Rooms ({property.rooms.length})</Text>
          {property.rooms.map((room) => (
            <View key={room.id} style={styles.roomItem}>
              <Text style={styles.roomName}>{room.name}</Text>
              <Text style={styles.roomType}>{room.type}{room.floor ? ` • ${room.floor}` : ""}</Text>
              {room.bedType && (
                <Text style={styles.roomDetail}>{room.bedCount}x {room.bedType}</Text>
              )}
              {room.towelCount && (
                <Text style={styles.roomDetail}>{room.towelCount} towels (of each)</Text>
              )}
              {room.stockingNotes && (
                <Text style={styles.roomDetail}>{room.stockingNotes}</Text>
              )}
            </View>
          ))}
        </Card>
      )}

      {/* Notes Timeline */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Notes ({notes.length})</Text>
        {notes.length === 0 ? (
          <Text style={styles.emptyText}>No notes yet</Text>
        ) : (
          notes.map((note) => (
            <View key={note.id} style={styles.noteItem}>
              <View style={styles.noteHeader}>
                <Text style={styles.noteType}>{note.noteType}</Text>
                <Text style={styles.noteDate}>
                  {new Date(note.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <Text style={styles.noteContent}>{note.content}</Text>
            </View>
          ))
        )}
      </Card>

      {/* Phase 6 Navigation Links */}
      <Text style={styles.sectionTitle}>Property Profile</Text>
      <View style={styles.navGrid}>
        <NavCard
          icon="photos"
          label="Photos"
          onPress={() => router.push(`/(admin)/properties/${id}/photos`)}
        />
        <NavCard
          icon="checklists"
          label="Checklists"
          onPress={() => router.push(`/(admin)/properties/${id}/checklists`)}
        />
        <NavCard
          icon="instructions"
          label="Standing Instructions"
          onPress={() => router.push(`/(admin)/properties/${id}/instructions`)}
        />
        <NavCard
          icon="preferences"
          label="Owner Preferences"
          onPress={() => router.push(`/(admin)/properties/${id}/owner-preferences`)}
        />
      </View>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const navIcons: Record<string, string> = {
  photos: "\uD83D\uDCF8",
  checklists: "\u2705",
  instructions: "\uD83D\uDCCB",
  preferences: "\u2699\uFE0F",
};

function NavCard({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.navCard} activeOpacity={0.7}>
      <Text style={styles.navIcon}>{navIcons[icon]}</Text>
      <Text style={styles.navLabel}>{label}</Text>
      <Text style={styles.navArrow}>{"\u203A"}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { padding: 16, paddingBottom: 40 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  name: { fontSize: 24, fontWeight: "700", color: "#111827" },
  code: { fontSize: 13, color: "#9ca3af", marginBottom: 4 },
  address: { fontSize: 14, color: "#6b7280", marginBottom: 16 },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: "600", color: "#6b7280", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  infoLabel: { fontSize: 14, color: "#6b7280" },
  infoValue: { fontSize: 14, color: "#111827", fontWeight: "500", textAlign: "right", flex: 1, marginLeft: 16 },
  instructionText: { fontSize: 14, color: "#374151", lineHeight: 20 },
  roomItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  roomName: { fontSize: 15, fontWeight: "600", color: "#111827" },
  roomType: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  roomDetail: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  noteItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  noteHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  noteType: { fontSize: 12, fontWeight: "500", color: "#3b82f6", textTransform: "capitalize" },
  noteDate: { fontSize: 12, color: "#9ca3af" },
  noteContent: { fontSize: 14, color: "#374151", lineHeight: 20 },
  emptyText: { fontSize: 14, color: "#9ca3af", fontStyle: "italic" },
  navGrid: { gap: 8, marginBottom: 24 },
  navCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  navIcon: { fontSize: 20, marginRight: 12 },
  navLabel: { flex: 1, fontSize: 15, fontWeight: "600", color: "#111827" },
  navArrow: { fontSize: 22, color: "#9ca3af", fontWeight: "300" },
});
