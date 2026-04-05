import {
  View,
  Text,
  ScrollView,
  TextInput,
  Switch,
  Alert,
  StyleSheet,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState, useEffect } from "react";
import {
  useExpense,
  useCreateExpense,
  useUpdateExpense,
  useDeleteExpense,
} from "../../../hooks/use-expenses";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { CurrencyInput } from "../../../components/ui/CurrencyInput";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function AddExpenseScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!id;

  const expenseQuery = useExpense(id);
  const expense = expenseQuery.data;

  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const deleteExpense = useDeleteExpense();

  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState(todayStr());
  const [categoryId, setCategoryId] = useState("");
  const [vendor, setVendor] = useState("");
  const [description, setDescription] = useState("");
  const [isDeductible, setIsDeductible] = useState(true);

  useEffect(() => {
    if (expense) {
      setAmount(expense.amount);
      setDate(expense.date);
      setCategoryId(expense.categoryId ?? "");
      setVendor(expense.vendor ?? "");
      setDescription(expense.description ?? "");
      setIsDeductible(expense.isDeductible);
    }
  }, [expense]);

  const handleSave = () => {
    if (amount <= 0) {
      Alert.alert("Invalid Amount", "Please enter an amount greater than zero.");
      return;
    }
    if (!date) {
      Alert.alert("Missing Date", "Please enter a date.");
      return;
    }

    if (isEditing && id) {
      updateExpense.mutate(
        {
          id,
          amount,
          date,
          categoryId: categoryId || undefined,
          vendor: vendor || undefined,
          description: description || undefined,
          isDeductible,
        },
        {
          onSuccess: () => router.back(),
          onError: (err: any) => Alert.alert("Error", err?.message ?? "Failed to update expense."),
        }
      );
    } else {
      createExpense.mutate(
        {
          amount,
          date,
          categoryId: categoryId || "uncategorized",
          vendor: vendor || undefined,
          description: description || undefined,
          isDeductible,
        },
        {
          onSuccess: () => router.back(),
          onError: (err: any) => Alert.alert("Error", err?.message ?? "Failed to create expense."),
        }
      );
    }
  };

  const handleDelete = () => {
    if (!id) return;
    Alert.alert("Delete Expense", "Are you sure you want to delete this expense?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          deleteExpense.mutate(id, {
            onSuccess: () => router.back(),
            onError: (err: any) => Alert.alert("Error", err?.message ?? "Failed to delete expense."),
          }),
      },
    ]);
  };

  const isSaving = createExpense.isPending || updateExpense.isPending;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{isEditing ? "Edit Expense" : "Add Expense"}</Text>

        {/* Amount */}
        <Card style={styles.section}>
          <CurrencyInput
            label="Amount"
            value={amount}
            onChangeValue={setAmount}
            placeholder="0.00"
          />
        </Card>

        {/* Fields */}
        <Card style={styles.section}>
          <Text style={styles.fieldLabel}>Date</Text>
          <TextInput
            style={styles.input}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#9ca3af"
          />

          <Text style={styles.fieldLabel}>Category</Text>
          <TextInput
            style={styles.input}
            value={categoryId}
            onChangeText={setCategoryId}
            placeholder="Category name or ID"
            placeholderTextColor="#9ca3af"
          />

          <Text style={styles.fieldLabel}>Vendor</Text>
          <TextInput
            style={styles.input}
            value={vendor}
            onChangeText={setVendor}
            placeholder="Vendor name"
            placeholderTextColor="#9ca3af"
          />

          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder="What was this expense for?"
            placeholderTextColor="#9ca3af"
            multiline
          />
        </Card>

        {/* Deductible Toggle */}
        <Card style={styles.section}>
          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleLabel}>Tax Deductible</Text>
              <Text style={styles.toggleHint}>Mark if this is a deductible business expense</Text>
            </View>
            <Switch
              value={isDeductible}
              onValueChange={setIsDeductible}
              trackColor={{ false: "#d1d5db", true: "#93c5fd" }}
              thumbColor={isDeductible ? "#2563eb" : "#f3f4f6"}
            />
          </View>
        </Card>

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            onPress={handleSave}
            variant="primary"
            size="lg"
            fullWidth
            loading={isSaving}
          >
            {isEditing ? "Update Expense" : "Save Expense"}
          </Button>
          <Button onPress={() => router.back()} variant="ghost" size="md" fullWidth>
            Cancel
          </Button>
          {isEditing && (
            <Button
              onPress={handleDelete}
              variant="danger"
              size="md"
              fullWidth
              loading={deleteExpense.isPending}
            >
              Delete Expense
            </Button>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { padding: 16 },
  title: { fontSize: 22, fontWeight: "700", color: "#111827", marginBottom: 16 },
  section: { marginBottom: 16 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#111827",
    backgroundColor: "#ffffff",
  },
  textarea: {
    minHeight: 60,
    textAlignVertical: "top",
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  toggleLabel: { fontSize: 15, fontWeight: "600", color: "#111827" },
  toggleHint: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  actions: { gap: 10, marginTop: 8 },
});
