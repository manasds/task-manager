export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { migrateOnBoot } = await import('./instrumentation.node');
    await migrateOnBoot();
  }
}
