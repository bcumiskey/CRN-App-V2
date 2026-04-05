import { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { CheckCircle } from "lucide-react-native";
import { Button } from "../../components/ui/Button";
import { useUpdateSettings } from "../../hooks/use-settings";
import { useCompleteOnboarding } from "../../hooks/use-notifications";

const TOTAL_STEPS = 6;

// ── Step components ─────────────────────────────────────────────

function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <View style={styles.stepCenter}>
      <View style={styles.logoPlaceholder}>
        <Text style={styles.logoText}>CRN</Text>
      </View>
      <Text style={styles.heading}>Welcome to Clean Right Now</Text>
      <Text style={styles.subtext}>
        The all-in-one app for managing your cleaning business. Let's get you set up in just a few minutes.
      </Text>
      <View style={styles.buttonRow}>
        <Button variant="primary" size="lg" fullWidth onPress={onNext}>
          Get Started
        </Button>
      </View>
    </View>
  );
}

interface ProfileData {
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  address: string;
}

function StepBusinessProfile({
  data,
  onChange,
  onNext,
  saving,
}: {
  data: ProfileData;
  onChange: (d: Partial<ProfileData>) => void;
  onNext: () => void;
  saving: boolean;
}) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.stepScroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.heading}>Business Profile</Text>
        <Text style={styles.subtext}>Tell us about your cleaning business.</Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Business Name</Text>
          <TextInput
            style={styles.input}
            value={data.businessName}
            onChangeText={(v) => onChange({ businessName: v })}
            placeholder="e.g. Sparkle Clean LLC"
            placeholderTextColor="#9ca3af"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Owner Name</Text>
          <TextInput
            style={styles.input}
            value={data.ownerName}
            onChangeText={(v) => onChange({ ownerName: v })}
            placeholder="Your full name"
            placeholderTextColor="#9ca3af"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={data.email}
            onChangeText={(v) => onChange({ email: v })}
            placeholder="email@example.com"
            placeholderTextColor="#9ca3af"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Phone</Text>
          <TextInput
            style={styles.input}
            value={data.phone}
            onChangeText={(v) => onChange({ phone: v })}
            placeholder="(555) 123-4567"
            placeholderTextColor="#9ca3af"
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Address</Text>
          <TextInput
            style={styles.input}
            value={data.address}
            onChangeText={(v) => onChange({ address: v })}
            placeholder="Business address"
            placeholderTextColor="#9ca3af"
          />
        </View>

        <View style={styles.buttonRow}>
          <Button variant="primary" size="lg" fullWidth onPress={onNext} loading={saving}>
            Next
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function StepFinancialModel({
  onKeepDefaults,
  onCustomize,
}: {
  onKeepDefaults: () => void;
  onCustomize: () => void;
}) {
  return (
    <View style={styles.stepCenter}>
      <Text style={styles.heading}>Financial Model</Text>
      <Text style={styles.subtext}>
        CRN uses a "Three Buckets" model to split every job's fee.
      </Text>

      <View style={styles.bucketsCard}>
        <View style={styles.bucketRow}>
          <View style={[styles.bucketDot, { backgroundColor: "#2563eb" }]} />
          <Text style={styles.bucketLabel}>Business</Text>
          <Text style={styles.bucketPercent}>10%</Text>
        </View>
        <View style={styles.bucketRow}>
          <View style={[styles.bucketDot, { backgroundColor: "#7c3aed" }]} />
          <Text style={styles.bucketLabel}>Owner</Text>
          <Text style={styles.bucketPercent}>10%</Text>
        </View>
        <View style={styles.bucketRow}>
          <View style={[styles.bucketDot, { backgroundColor: "#16a34a" }]} />
          <Text style={styles.bucketLabel}>Workers</Text>
          <Text style={styles.bucketPercent}>80%</Text>
        </View>
      </View>

      <Text style={styles.hintText}>
        This works for most cleaning businesses. You can adjust in Settings anytime.
      </Text>

      <View style={styles.buttonRow}>
        <Button variant="primary" size="lg" fullWidth onPress={onKeepDefaults}>
          Keep Defaults
        </Button>
      </View>
      <View style={[styles.buttonRow, { marginTop: 8 }]}>
        <Button variant="outline" size="lg" fullWidth onPress={onCustomize}>
          Customize
        </Button>
      </View>
    </View>
  );
}

interface PropertyData {
  name: string;
  code: string;
  address: string;
  defaultFee: string;
}

function StepFirstProperty({
  data,
  onChange,
  onAdd,
  onSkip,
}: {
  data: PropertyData;
  onChange: (d: Partial<PropertyData>) => void;
  onAdd: () => void;
  onSkip: () => void;
}) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.stepScroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.heading}>Add Your First Property</Text>
        <Text style={styles.subtext}>
          Properties are the locations your team cleans. You can add more later.
        </Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Property Name</Text>
          <TextInput
            style={styles.input}
            value={data.name}
            onChangeText={(v) => onChange({ name: v })}
            placeholder="e.g. Smith Residence"
            placeholderTextColor="#9ca3af"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Property Code</Text>
          <TextInput
            style={styles.input}
            value={data.code}
            onChangeText={(v) => onChange({ code: v })}
            placeholder="e.g. SMITH01"
            placeholderTextColor="#9ca3af"
            autoCapitalize="characters"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Address</Text>
          <TextInput
            style={styles.input}
            value={data.address}
            onChangeText={(v) => onChange({ address: v })}
            placeholder="123 Main St"
            placeholderTextColor="#9ca3af"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Default Fee ($)</Text>
          <TextInput
            style={styles.input}
            value={data.defaultFee}
            onChangeText={(v) => onChange({ defaultFee: v })}
            placeholder="150.00"
            placeholderTextColor="#9ca3af"
            keyboardType="decimal-pad"
          />
        </View>

        <View style={styles.buttonRow}>
          <Button variant="primary" size="lg" fullWidth onPress={onAdd}>
            Add Property
          </Button>
        </View>

        <TouchableOpacity style={styles.skipLink} onPress={onSkip}>
          <Text style={styles.skipText}>Skip for Now</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function StepCalendarSources({
  onSetup,
  onSkip,
}: {
  onSetup: () => void;
  onSkip: () => void;
}) {
  return (
    <View style={styles.stepCenter}>
      <Text style={styles.heading}>Calendar Sources</Text>
      <Text style={styles.subtext}>
        Do you receive schedules from a booking platform like VRBO, Airbnb, or Guesty?
      </Text>

      <View style={styles.buttonRow}>
        <Button variant="primary" size="lg" fullWidth onPress={onSetup}>
          Yes, Set Up Now
        </Button>
      </View>
      <View style={[styles.buttonRow, { marginTop: 8 }]}>
        <Button variant="outline" size="lg" fullWidth onPress={onSkip}>
          No, I'll Add Jobs Manually
        </Button>
      </View>
    </View>
  );
}

function StepDone({ onGoToDashboard }: { onGoToDashboard: () => void }) {
  return (
    <View style={styles.stepCenter}>
      <View style={styles.doneIcon}>
        <CheckCircle size={64} color="#16a34a" />
      </View>
      <Text style={styles.heading}>You're All Set!</Text>
      <Text style={styles.subtext}>
        Your business is ready to go. Here are some things you can do next:
      </Text>

      <View style={styles.quickLinks}>
        <Text style={styles.quickLinkItem}>Add a Job</Text>
        <Text style={styles.quickLinkItem}>Add Team Member</Text>
        <Text style={styles.quickLinkItem}>Explore Settings</Text>
      </View>

      <View style={styles.buttonRow}>
        <Button variant="primary" size="lg" fullWidth onPress={onGoToDashboard}>
          Go to Dashboard
        </Button>
      </View>
    </View>
  );
}

// ── Progress dots ───────────────────────────────────────────────

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <View style={styles.dotsContainer}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[styles.dot, i === current && styles.dotActive]}
        />
      ))}
    </View>
  );
}

// ── Main screen ─────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();
  const updateSettings = useUpdateSettings();
  const completeOnboarding = useCompleteOnboarding();

  const [step, setStep] = useState(0);

  const [profile, setProfile] = useState<ProfileData>({
    businessName: "",
    ownerName: "",
    email: "",
    phone: "",
    address: "",
  });

  const [property, setProperty] = useState<PropertyData>({
    name: "",
    code: "",
    address: "",
    defaultFee: "",
  });

  const next = useCallback(() => setStep((s) => s + 1), []);

  const handleSaveProfile = useCallback(async () => {
    await updateSettings.mutateAsync({
      businessName: profile.businessName,
      ownerName: profile.ownerName,
      email: profile.email,
      phone: profile.phone,
      address: profile.address,
    });
    next();
  }, [profile, updateSettings, next]);

  const handleFinish = useCallback(async () => {
    await completeOnboarding.mutateAsync();
    router.replace("/(admin)" as never);
  }, [completeOnboarding, router]);

  const handleSetupCalendar = useCallback(() => {
    // Mark step as visited, then navigate after onboarding
    setStep(5); // go to Done step, calendar setup happens after
  }, []);

  return (
    <View style={styles.screen}>
      <View style={styles.content}>
        {step === 0 && <StepWelcome onNext={next} />}
        {step === 1 && (
          <StepBusinessProfile
            data={profile}
            onChange={(d) => setProfile((prev) => ({ ...prev, ...d }))}
            onNext={handleSaveProfile}
            saving={updateSettings.isPending}
          />
        )}
        {step === 2 && (
          <StepFinancialModel
            onKeepDefaults={next}
            onCustomize={next}
          />
        )}
        {step === 3 && (
          <StepFirstProperty
            data={property}
            onChange={(d) => setProperty((prev) => ({ ...prev, ...d }))}
            onAdd={next}
            onSkip={next}
          />
        )}
        {step === 4 && (
          <StepCalendarSources
            onSetup={handleSetupCalendar}
            onSkip={next}
          />
        )}
        {step === 5 && <StepDone onGoToDashboard={handleFinish} />}
      </View>

      <ProgressDots current={step} total={TOTAL_STEPS} />
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  content: {
    flex: 1,
  },
  stepCenter: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  stepScroll: {
    paddingHorizontal: 32,
    paddingTop: 48,
    paddingBottom: 32,
  },
  logoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 24,
  },
  logoText: {
    fontSize: 24,
    fontWeight: "800",
    color: "#ffffff",
  },
  heading: {
    fontSize: 26,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    marginBottom: 10,
  },
  subtext: {
    fontSize: 15,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  buttonRow: {
    marginTop: 16,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#111827",
    backgroundColor: "#ffffff",
  },
  bucketsCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    gap: 14,
  },
  bucketRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  bucketDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  bucketLabel: {
    flex: 1,
    fontSize: 15,
    color: "#374151",
    fontWeight: "500",
  },
  bucketPercent: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
  },
  hintText: {
    fontSize: 13,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 8,
  },
  skipLink: {
    alignSelf: "center",
    marginTop: 16,
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 15,
    color: "#2563eb",
    fontWeight: "500",
  },
  doneIcon: {
    alignSelf: "center",
    marginBottom: 20,
  },
  quickLinks: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginBottom: 8,
  },
  quickLinkItem: {
    fontSize: 15,
    color: "#2563eb",
    fontWeight: "500",
  },
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 40,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#d1d5db",
  },
  dotActive: {
    backgroundColor: "#2563eb",
    width: 24,
    borderRadius: 4,
  },
});
