export function WelcomeHeading({ subtitle }: { subtitle: string }) {
  return (
    <div className="flex flex-col items-center gap-3 mb-6">
      <PoolBallLogo />
      <h1 className="text-2xl font-bold md:text-3xl text-white">Welcome to PoolDN</h1>
      <p className="text-sm text-mist-400">{subtitle}</p>
    </div>
  );
}

function PoolBallLogo() {
  return (
    <div
      className="relative inline-flex size-14 items-center justify-center rounded-full"
      style={{
        background: "radial-gradient(circle, #161b1d 0%, #161b1d 60%, transparent 70%)",
        boxShadow: "0 0 24px 4px rgba(208,243,13,0.45)",
      }}
    >
      <div className="absolute inset-0 rounded-full border-[3px] border-primary" />
      <span className="text-primary font-black text-lg">8</span>
    </div>
  );
}
