// Marca de agua — mismo asset del CareCard (corazón + 2 figuras). El corazón va
// en teal a opacidad baja; las 2 figuras van "caladas" en el color del fondo real
// (fill sólido, sin atenuar) para que el logo se lea completo — a esta opacidad,
// un simple tono-sobre-tono entre el corazón y las figuras se perdía por completo.
// Nunca detrás de texto: las tarjetas tienen fondo opaco, así que solo asoma en
// el espacio abierto alrededor de ellas.
export default function WatermarkHeart({ heartOpacity, cutout, width = 230, height = 230, style }) {
  return (
    <svg
      width={width} height={height} viewBox="0 0 100 100"
      style={{ position: 'absolute', pointerEvents: 'none', ...style }}
      aria-hidden="true"
    >
      <path
        d="M50 88C22 68 8 54 8 34 8 22 17 13 29 13c8 0 15 5 21 13 6-8 13-13 21-13 12 0 21 9 21 21 0 20-14 34-42 54Z"
        fill="#087F70" fillOpacity={heartOpacity}
      />
      <circle cx="40" cy="40" r="7" fill={cutout} /><path d="M28 62c0-8 5-13 12-13s12 5 12 13Z" fill={cutout} />
      <circle cx="60" cy="45" r="5.5" fill={cutout} /><path d="M50 62c0-7 4-11 10-11s10 4 10 11Z" fill={cutout} />
    </svg>
  )
}
