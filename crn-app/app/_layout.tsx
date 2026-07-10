import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { UnlockModal } from "../components/UnlockModal";
import { WorkerLoginModal } from "../components/WorkerLoginModal";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 2,
    },
  },
});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(admin)" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(worker)" />
        </Stack>
        <UnlockModal />
        <WorkerLoginModal />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
