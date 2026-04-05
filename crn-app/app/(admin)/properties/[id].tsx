// This file is superseded by the [id]/ directory.
// DELETE THIS FILE - Expo Router uses [id]/index.tsx instead.
// Keeping this file may cause route conflicts.
import { Redirect, useLocalSearchParams } from "expo-router";

export default function PropertyDetailRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={`/(admin)/properties/${id}`} />;
}
