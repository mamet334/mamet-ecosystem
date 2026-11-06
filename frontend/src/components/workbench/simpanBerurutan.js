export async function simpanBerurutan(sedangRef, tertundaRef, simpan, ulangi) {
  if (sedangRef.current) {
    tertundaRef.current = true;
    return;
  }
  sedangRef.current = true;
  try {
    await simpan();
  } finally {
    sedangRef.current = false;
    if (tertundaRef.current) {
      tertundaRef.current = false;
      ulangi();
    }
  }
}
