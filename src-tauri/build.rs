fn main() {
  // Tauri embeds these images in the executable and window. Rebuild the
  // resources when an icon changes instead of keeping Cargo's cached copy.
  println!("cargo:rerun-if-changed=icons/icon.ico");
  println!("cargo:rerun-if-changed=icons/icon.png");
  println!("cargo:rerun-if-changed=icons/32x32.png");
  println!("cargo:rerun-if-changed=icons/128x128.png");
  println!("cargo:rerun-if-changed=icons/128x128@2x.png");
  println!("cargo:rerun-if-changed=icons/icon.icns");
  tauri_build::build()
}
