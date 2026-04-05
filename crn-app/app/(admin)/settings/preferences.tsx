import { View, Text, ScrollView, Switch, StyleSheet, Alert } from "react-native";
import { useState, useEffect } from "react";
import { usePreferences, useUpdatePreferences } from "../../../hooks/use-settings";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";

export default function PreferencesScreen() {
  const prefsQuery = usePreferences();
  const updatePrefs = useUpdatePreferences();

  const prefs = prefsQuery.data;

  const [defaultCalendarView, setDefaultCalendarView] = useState("week");
  const [jobCompletionAction, setJobCompletionAction] = useState("stay");
  const [timeFormat, setTimeFormat] = useState("12h");
  const [startOfWeek, setStartOfWeek] = useState("sunday");
  const [notifyUpcomingJobs, setNotifyUpcomingJobs] = useState(true);
  const [notifyScheduleChanges, setNotifyScheduleChanges] = useState(true);
  const [notifyOverdueInvoices, setNotifyOverdueInvoices] = useState(true);

  useEffect(() => {
    if (prefs) {
      setDefaultCalendarView(prefs.defaultCalendarView);
      setJobCompletionAction(prefs.jobCompletionAction);
      setTimeFormat(prefs.timeFormat);
      setStartOfWeek(prefs.startOfWeek);
      setNotifyUpcomingJobs(prefs.notifyUpcomingJobs);
      setNotifyScheduleChanges(prefs.notifyScheduleChanges);
      setNotifyOverdueInvoices(prefs.notifyOverdueInvoices);
    }
  }, [prefs]);

  const handleSave = async () => {
    try {
      await updatePrefs.mutateAsync({
        defaultCalendarView,
        jobCompletionAction,
        timeFormat,
        startOfWeek,
        notifyUpcomingJobs,
        notifyScheduleChanges,
        notifyOverdueInvoices,
      });
      Alert.alert("Saved", "Preferences updated.");
    } catch {
      Alert.alert("Error", "Failed to save preferences.");
    }
  };

  const PillSelect = ({ label, options, value, onChange }: {
    label: string;
    options: Array<{ key: string; label: string }>;
    value: string;
    onChange: (v: string) => void;
  }) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.pillRow}>
        {options.map((opt) => (
          <Button
            key={opt.key}
            variant={value === opt.key ? "primary" : "outline"}
            size="sm"
            onPress={() => onChange(opt.key)}
          >
            {opt.label}
          </Button>
        ))}
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Preferences</Text>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Display</Text>

        <PillSelect
          label="Default Calendar View"
          options={[{ key: "day", label: "Day" }, { key: "week", label: "Week" }, { key: "month", label: "Month" }]}
          value={defaultCalendarView}
          onChange={setDefaultCalendarView}
        />

        <PillSelect
          label="Time Format"
          options={[{ key: "12h", label: "12 Hour" }, { key: "24h", label: "24 Hour" }]}
          value={timeFormat}
          onChange={setTimeFormat}
        />

        <PillSelect
          label="Start of Week"
          options={[{ key: "sunday", label: "Sunday" }, { key: "monday", label: "Monday" }]}
          value={startOfWeek}
          onChange={setStartOfWeek}
        />
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Job Completion</Text>
        <PillSelect
          label="After completing a job"
          options={[
            { key: "stay", label: "Stay" },
            { key: "prompt_invoice", label: "Invoice" },
            { key: "show_summary", label: "Summary" },
            { key: "next_job", label: "Next Job" },
          ]}
          value={jobCompletionAction}
          onChange={setJobCompletionAction}
        />
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <ToggleRow label="Upcoming job alerts" value={notifyUpcomingJobs} onChange={setNotifyUpcomingJobs} />
        <ToggleRow label="Schedule change alerts" value={notifyScheduleChanges} onChange={setNotifyScheduleChanges} />
        <ToggleRow label="Overdue invoice alerts" value={notifyOverdueInvoices} onChange={setNotifyOverdueInvoices} />
      </Card>

      <View style={styles.actions}>
        <Button variant="primary" onPress={handleSave} loading={updatePrefs.isPending} fullWidth>
          Save Preferences
        </Button>
      </View>
    </ScrollView>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "700", color: "#111827", marginBottom: 16 },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: "600", color: "#6b7280", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  label: { fontSize: 14, fontWeight: "500", color: "#374151", marginBottom: 6 },
  field: { marginBottom: 16 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10 },
  toggleLabel: { fontSize: 15, color: "#374151" },
  actions: { marginTop: 16 },
});
