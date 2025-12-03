'use client'

export default function DarkBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Subtle dark gradient base */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(135deg, #0a0a0a 0%, #0a1220 40%, #0a0a0a 100%)'
        }}
      />

      {/* Center hero spotlight gradient */}
      <div
        className="absolute"
        style={{
          top: '20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '800px',
          height: '800px',
          background: 'radial-gradient(circle, rgba(0, 128, 255, 0.12) 0%, transparent 70%)',
          filter: 'blur(120px)'
        }}
      />

      {/* Subtle blue radial glows */}
      <div
        className="absolute"
        style={{
          top: '10%',
          left: '20%',
          width: '500px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(0, 128, 255, 0.08) 0%, transparent 70%)',
          filter: 'blur(80px)'
        }}
      />
      <div
        className="absolute"
        style={{
          bottom: '15%',
          right: '15%',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(0, 128, 255, 0.06) 0%, transparent 70%)',
          filter: 'blur(100px)'
        }}
      />

      {/* Enhanced dotted grid pattern */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(0, 128, 255, 0.25) 1px, transparent 1px)`,
          backgroundSize: '30px 30px'
        }}
      />

      {/* Enhanced noise texture */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat'
        }}
      />

      {/* Subtle scan lines */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 128, 255, 0.1) 2px, rgba(0, 128, 255, 0.1) 4px)',
        }}
      />

      {/* Floating geometric shapes - enhanced */}
      <div
        className="absolute"
        style={{
          top: '20%',
          left: '10%',
          width: '12px',
          height: '12px',
          background: '#0080FF',
          transform: 'rotate(45deg)',
          opacity: 0.8,
          boxShadow: '0 0 24px rgba(0, 128, 255, 0.6)'
        }}
      />
      <div
        className="absolute"
        style={{
          top: '30%',
          right: '15%',
          width: '16px',
          height: '16px',
          border: '2px solid #0080FF',
          transform: 'rotate(45deg)',
          opacity: 0.7,
          boxShadow: '0 0 20px rgba(0, 128, 255, 0.5)'
        }}
      />
      <div
        className="absolute"
        style={{
          bottom: '25%',
          left: '20%',
          width: '10px',
          height: '10px',
          background: '#0080FF',
          borderRadius: '50%',
          opacity: 0.6,
          boxShadow: '0 0 20px rgba(0, 128, 255, 0.7)'
        }}
      />
      <div
        className="absolute"
        style={{
          bottom: '40%',
          right: '25%',
          width: '14px',
          height: '14px',
          background: 'rgba(0, 128, 255, 0.6)',
          transform: 'rotate(45deg)',
          opacity: 0.7,
          boxShadow: '0 0 24px rgba(0, 128, 255, 0.5)'
        }}
      />
      <div
        className="absolute"
        style={{
          top: '60%',
          left: '40%',
          width: '8px',
          height: '8px',
          background: '#ffffff',
          borderRadius: '50%',
          opacity: 0.5
        }}
      />
      <div
        className="absolute"
        style={{
          top: '15%',
          right: '35%',
          width: '10px',
          height: '10px',
          border: '2px solid #0080FF',
          transform: 'rotate(45deg)',
          opacity: 0.5
        }}
      />
    </div>
  )
}
