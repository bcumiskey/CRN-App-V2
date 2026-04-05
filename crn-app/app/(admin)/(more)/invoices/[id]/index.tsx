import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState, useEffect, useMemo } from "react";
import {
  useInvoice,
  useUpdateInvoice,
  useSendInvoice,
  useMarkInvoicePaid,
  useVoidInvoice,
  useAddLineItem,
  useUpdateLineItem,
  useDeleteLineItem,
} from "../../../../../hooks/use-invoices";
import { Card } from "../../../../../components/ui/Card";
import { Button } from "../../../../../components/ui/Button";
import { StatusBadge } from "../../../../../components/ui/StatusBadge";
import { CurrencyInput } from "../../../../../components/ui/CurrencyInput";

function fmt(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function InvoiceEditorScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const invoiceQuery = useInvoice(id);
  const invoice = invoiceQuery.data;

  const updateInvoice = useUpdateInvoice();
  const sendInvoice = useSendInvoice();
  const markPaid = useMarkInvoicePaid();
  const voidInvoice = useVoidInvoice();
  const addLineItem = useAddLineItem();
  const updateLineItem = useUpdateLineItem();
  const deleteLineItem = useDeleteLineItem();

  // Editable state
  const [invoiceDate, setInvoiceDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  // New line item form
  const [showAddItem, setShowAddItem] = useState(false);
  const [newDesc, setNewDesc] = useState("");
  const [newAmount, setNewAmount] = useState<number>(0);
  const [newDate, setNewDate] = useState(todayStr());

  // Editing existing line item
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editAmount, setEditAmount] = useState<number>(0);

  useEffect(() => {
    if (invoice) {
      setInvoiceDate(invoice.invoiceDate ?? "");
      setDueDate(invoice.dueDate ?? "");
      setPaymentTerms(invoice.paymentTerms ?? "");
      setDiscount(invoice.discount ?? 0);
      setNotes(invoice.notes ?? "");
      setInternalNotes(invoice.internalNotes ?? "");
    }
  }, [invoice]);

  const lineItems = invoice?.lineItems ?? [];
  const subtotal = lineItems.reduce((sum, li) => sum + li.amount, 0);
  const total = subtotal - discount;
  const status = invoice?.status ?? "draft";

  const isDraft = status === "draft";
  const isSent = status === "sent";
  const isOverdue = status === "overdue";
  const isPaid = status === "paid";
  const isVoid = status === "void";
  const isEditable = isDraft;

  // ── Actions ────────────────────────────────────────────

  const handleSaveDraft = () => {
    if (!id) return;
    updateInvoice.mutate({
      id,
      invoiceDate,
      dueDate: dueDate || undefined,
      paymentTerms,
      discount,
      notes: notes || undefined,
      internalNotes: internalNotes || undefined,
    });
  };

  const handleSend = () => {
    if (!id) return;
    Alert.alert(
      "Send Invoice",
      `Send invoice ${invoice?.invoiceNumber} to ${invoice?.owner?.email ?? invoice?.owner?.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send",
          onPress: () => sendInvoice.mutate(id, { onSuccess: () => invoiceQuery.refetch() }),
        },
      ]
    );
  };

  const handleMarkPaid = () => {
    if (!id) return;
    Alert.alert("Mark as Paid", "Enter payment date (YYYY-MM-DD):", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Today",
        onPress: () =>
          markPaid.mutate(
            { id, paidDate: todayStr() },
            { onSuccess: () => invoiceQuery.refetch() }
          ),
      },
    ]);
  };

  const handleVoid = () => {
    if (!id) return;
    Alert.alert(
      "Void Invoice",
      "This will permanently void this invoice. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Void",
          style: "destructive",
          onPress: () => voidInvoice.mutate(id, { onSuccess: () => invoiceQuery.refetch() }),
        },
      ]
    );
  };

  const handleAddItem = () => {
    if (!id || !newDesc.trim()) return;
    addLineItem.mutate(
      { invoiceId: id, description: newDesc, amount: newAmount, date: newDate || undefined },
      {
        onSuccess: () => {
          setNewDesc("");
          setNewAmount(0);
          setNewDate(todayStr());
          setShowAddItem(false);
        },
      }
    );
  };

  const startEditItem = (li: { id: string; description: string; amount: number }) => {
    setEditingId(li.id);
    setEditDesc(li.description);
    setEditAmount(li.amount);
  };

  const saveEditItem = () => {
    if (!id || !editingId) return;
    updateLineItem.mutate(
      { invoiceId: id, lid: editingId, description: editDesc, amount: editAmount },
      { onSuccess: () => setEditingId(null) }
    );
  };

  const handleDeleteItem = (lid: string) => {
    if (!id) return;
    Alert.alert("Delete Line Item", "Remove this line item?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteLineItem.mutate({ invoiceId: id, lid }),
      },
    ]);
  };

  if (!invoice && invoiceQuery.isLoading) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Loading invoice...</Text>
      </View>
    );
  }

  if (!invoice) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Invoice not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={invoiceQuery.isRefetching} onRefresh={() => invoiceQuery.refetch()} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>
            <StatusBadge status={status} size="md" />
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          {isDraft && (
            <>
              <Button onPress={handleSaveDraft} variant="secondary" size="sm" loading={updateInvoice.isPending}>
                Save Draft
              </Button>
              <Button onPress={handleSend} variant="primary" size="sm" loading={sendInvoice.isPending}>
                Send
              </Button>
            </>
          )}
          {(isSent || isOverdue) && (
            <>
              <Button onPress={handleMarkPaid} variant="success" size="sm" loading={markPaid.isPending}>
                Mark Paid
              </Button>
              <Button onPress={handleVoid} variant="danger" size="sm" loading={voidInvoice.isPending}>
                Void
              </Button>
            </>
          )}
        </View>

        {/* Bill To */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Bill To</Text>
          <Text style={styles.ownerName}>{invoice.owner?.name ?? "Unknown Owner"}</Text>
          {invoice.owner?.email && <Text style={styles.ownerEmail}>{invoice.owner.email}</Text>}
          {invoice.property && <Text style={styles.propertyName}>{invoice.property.name}</Text>}
        </Card>

        {/* Details */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Invoice Date</Text>
            <TextInput
              style={[styles.fieldInput, !isEditable && styles.fieldDisabled]}
              value={invoiceDate}
              onChangeText={setInvoiceDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#9ca3af"
              editable={isEditable}
            />
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Due Date</Text>
            <TextInput
              style={[styles.fieldInput, !isEditable && styles.fieldDisabled]}
              value={dueDate}
              onChangeText={setDueDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#9ca3af"
              editable={isEditable}
            />
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Payment Terms</Text>
            <TextInput
              style={[styles.fieldInput, !isEditable && styles.fieldDisabled]}
              value={paymentTerms}
              onChangeText={setPaymentTerms}
              placeholder="e.g. Net 30"
              placeholderTextColor="#9ca3af"
              editable={isEditable}
            />
          </View>
        </Card>

        {/* Line Items */}
        <Card style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Line Items</Text>
            {isEditable && (
              <TouchableOpacity onPress={() => setShowAddItem(!showAddItem)}>
                <Text style={styles.addItemText}>+ Add Item</Text>
              </TouchableOpacity>
            )}
          </View>

          {lineItems.length === 0 && !showAddItem && (
            <Text style={styles.emptyItems}>No line items yet.</Text>
          )}

          {lineItems.map((li) => (
            <View key={li.id} style={styles.lineItem}>
              {editingId === li.id ? (
                <View style={styles.editItemForm}>
                  <TextInput
                    style={styles.editInput}
                    value={editDesc}
                    onChangeText={setEditDesc}
                    placeholder="Description"
                    placeholderTextColor="#9ca3af"
                  />
                  <CurrencyInput
                    value={editAmount}
                    onChangeValue={setEditAmount}
                  />
                  <View style={styles.editActions}>
                    <Button onPress={saveEditItem} size="sm" variant="primary" loading={updateLineItem.isPending}>
                      Save
                    </Button>
                    <Button onPress={() => setEditingId(null)} size="sm" variant="ghost">
                      Cancel
                    </Button>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => isEditable && startEditItem(li)}
                  onLongPress={() => isEditable && handleDeleteItem(li.id)}
                  style={styles.lineItemContent}
                >
                  <View style={styles.lineItemLeft}>
                    {li.date && <Text style={styles.lineDate}>{li.date}</Text>}
                    <View style={styles.lineDescRow}>
                      {li.jobId && <Text style={styles.chainIcon}>&#128279;</Text>}
                      <Text style={styles.lineDesc} numberOfLines={2}>{li.description}</Text>
                    </View>
                  </View>
                  <Text style={styles.lineAmount}>{fmt(li.amount)}</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}

          {/* Add item form */}
          {showAddItem && (
            <View style={styles.addItemForm}>
              <TextInput
                style={styles.addInput}
                value={newDate}
                onChangeText={setNewDate}
                placeholder="Date (YYYY-MM-DD)"
                placeholderTextColor="#9ca3af"
              />
              <TextInput
                style={styles.addInput}
                value={newDesc}
                onChangeText={setNewDesc}
                placeholder="Description"
                placeholderTextColor="#9ca3af"
              />
              <CurrencyInput value={newAmount} onChangeValue={setNewAmount} label="Amount" />
              <View style={styles.addItemActions}>
                <Button onPress={handleAddItem} size="sm" variant="primary" loading={addLineItem.isPending}>
                  Add
                </Button>
                <Button onPress={() => setShowAddItem(false)} size="sm" variant="ghost">
                  Cancel
                </Button>
              </View>
            </View>
          )}
        </Card>

        {/* Discount */}
        {isEditable && (
          <Card style={styles.section}>
            <CurrencyInput
              label="Discount"
              value={discount}
              onChangeValue={setDiscount}
            />
          </Card>
        )}

        {/* Totals */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Totals</Text>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{fmt(subtotal)}</Text>
          </View>
          {discount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Discount</Text>
              <Text style={[styles.totalValue, { color: "#dc2626" }]}>-{fmt(discount)}</Text>
            </View>
          )}
          <View style={[styles.totalRow, styles.totalRowFinal]}>
            <Text style={styles.totalFinalLabel}>Total</Text>
            <Text style={styles.totalFinalValue}>{fmt(total)}</Text>
          </View>
        </Card>

        {/* Notes */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text style={styles.fieldLabel}>Client Notes</Text>
          <TextInput
            style={[styles.textarea, !isEditable && styles.fieldDisabled]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Notes visible on the invoice..."
            placeholderTextColor="#9ca3af"
            multiline
            editable={isEditable}
          />
          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Internal Notes</Text>
          <TextInput
            style={[styles.textarea, !isEditable && styles.fieldDisabled]}
            value={internalNotes}
            onChangeText={setInternalNotes}
            placeholder="Private notes (not on invoice)..."
            placeholderTextColor="#9ca3af"
            multiline
            editable={isEditable}
          />
        </Card>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom action bar */}
      {!isPaid && !isVoid && (
        <View style={styles.bottomBar}>
          {isDraft && (
            <Button onPress={handleSend} variant="primary" size="lg" fullWidth loading={sendInvoice.isPending}>
              Send Invoice
            </Button>
          )}
          {(isSent || isOverdue) && (
            <Button onPress={handleMarkPaid} variant="success" size="lg" fullWidth loading={markPaid.isPending}>
              Mark as Paid
            </Button>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { fontSize: 15, color: "#6b7280" },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  invoiceNumber: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  ownerName: { fontSize: 16, fontWeight: "600", color: "#111827" },
  ownerEmail: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  propertyName: { fontSize: 13, color: "#9ca3af", marginTop: 2 },
  fieldRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6b7280",
  },
  fieldInput: {
    fontSize: 14,
    color: "#111827",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 140,
    textAlign: "right",
    backgroundColor: "#ffffff",
  },
  fieldDisabled: {
    backgroundColor: "#f3f4f6",
    color: "#6b7280",
  },
  addItemText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2563eb",
  },
  emptyItems: {
    fontSize: 13,
    color: "#9ca3af",
    textAlign: "center",
    paddingVertical: 16,
  },
  lineItem: {
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    paddingVertical: 10,
  },
  lineItemContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  lineItemLeft: { flex: 1, marginRight: 12 },
  lineDate: { fontSize: 11, color: "#9ca3af", marginBottom: 2 },
  lineDescRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  chainIcon: { fontSize: 12 },
  lineDesc: { fontSize: 14, color: "#374151", flex: 1 },
  lineAmount: { fontSize: 15, fontWeight: "600", color: "#111827" },
  editItemForm: { paddingVertical: 6 },
  editInput: {
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#111827",
    marginBottom: 8,
    backgroundColor: "#ffffff",
  },
  editActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  addItemForm: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  addInput: {
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#111827",
    marginBottom: 8,
    backgroundColor: "#ffffff",
  },
  addItemActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  totalRowFinal: {
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    marginTop: 4,
    paddingTop: 10,
  },
  totalLabel: { fontSize: 14, color: "#6b7280" },
  totalValue: { fontSize: 14, fontWeight: "500", color: "#111827" },
  totalFinalLabel: { fontSize: 16, fontWeight: "700", color: "#111827" },
  totalFinalValue: { fontSize: 18, fontWeight: "700", color: "#111827" },
  textarea: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111827",
    minHeight: 60,
    textAlignVertical: "top",
    backgroundColor: "#ffffff",
  },
  bottomBar: {
    padding: 16,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
});
