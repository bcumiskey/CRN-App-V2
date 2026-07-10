import { View, Text, ScrollView, TouchableOpacity, Linking, StyleSheet, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useWorkerProperty } from "../../../hooks/use-worker";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";

export default function WorkerPropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const propertyQuery = useWorkerProperty(id);
  const property = propertyQuery.data;

  if (propertyQuery.isError) {
    return (
      <View style={styles.loading}>
        <Text style={styles.errorTitle}>Couldn't load this property</Text>
        <Text style={styles.errorMessage}>
          Check your connection and try again.
        </Text>
        <View style={styles.errorActions}>
          <Button variant="primary" size="md" onPress={() => propertyQuery.refetch()} loading={propertyQuery.isRefetching}>
            Retry
          </Button>
          <Button variant="ghost" size="md" onPress={() => router.back()}>
            Go Back
          </Button>
        </View>
      </View>
    );
  }

  if (!property) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.name}>{property.name}</Text>
      {property.address && (
        <TouchableOpacity onPress={() => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(property.address!)}`)}>
          <Text style={styles.address}>{property.address} →</Text>
        </TouchableOpacity>
      )}

      {/* Access */}
      {property.accessInstructions && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Access</Text>
          <Text style={styles.accessCode}>{property.accessInstructions}</Text>
        </Card>
      )}

      {/* WiFi */}
      {property.wifiName && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>WiFi</Text>
          <Text style={styles.wifiName}>{property.wifiName}</Text>
          {property.wifiPassword && <Text style={styles.wifiPass}>{property.wifiPassword}</Text>}
        </Card>
      )}

      {/* Parking */}
      {property.parkingNotes && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Parking</Text>
          <Text style={styles.infoText}>{property.parkingNotes}</Text>
        </Card>
      )}

      {/* Trash */}
      {property.trashDay && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Trash Day</Text>
          <Text style={styles.infoText}>{property.trashDay}</Text>
        </Card>
      )}

      {/* Special Instructions */}
      {property.specialInstructions && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Special Instructions</Text>
          <Text style={styles.infoText}>{property.specialInstructions}</Text>
        </Card>
      )}

      {/* Rooms */}
      {property.rooms.length > 0 && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Room Setup ({property.rooms.length})</Text>
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

      {/* NO financial data: no fee, no house cut, no owner info, no billing */}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { padding: 16, paddingBottom: 40 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14, color: "#6b7280" },
  errorTitle: { fontSize: 18, fontWeight: "600", color: "#111827", marginBottom: 8, textAlign: "center" },
  errorMessage: { fontSize: 14, color: "#6b7280", textAlign: "center", marginBottom: 20 },
  errorActions: { gap: 10, alignSelf: "stretch" },
  name: { fontSize: 24, fontWeight: "700", color: "#111827" },
  address: { fontSize: 15, color: "#2563eb", textDecorationLine: "underline", marginBottom: 16 },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: "600", color: "#6b7280", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  accessCode: { fontSize: 20, fontWeight: "700", color: "#111827", backgroundColor: "#f0fdf4", padding: 16, borderRadius: 8, textAlign: "center" },
  wifiName: { fontSize: 16, fontWeight: "600", color: "#111827" },
  wifiPass: { fontSize: 14, color: "#6b7280", marginTop: 2 },
  infoText: { fontSize: 14, color: "#374151", lineHeight: 20 },
  roomItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  roomName: { fontSize: 15, fontWeight: "600", color: "#111827" },
  roomType: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  roomDetail: { fontSize: 13, color: "#6b7280", marginTop: 2 },
});
