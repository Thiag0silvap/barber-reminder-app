import { Stack } from "expo-router";
import { useEffect } from "react";
import { runMigrations } from "../src/database/migrations";

export default function RootLayout() {

  useEffect(() => {
    runMigrations();
  }, []);

  return <Stack />;
}