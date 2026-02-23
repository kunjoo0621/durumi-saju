"use client";

import MenuDrawer from "../MenuDrawer";

export default function LandingHeader() {
  return (
    <header className="sticky top-0 z-[120] bg-[#0D0D0D] px-5 py-5">
      <div className="max-w-[640px] mx-auto flex items-center justify-between">
        <div className="w-10" />
        <h1 className="text-title-3 font-aggro text-white">사주보는 두루미</h1>
        <MenuDrawer />
      </div>
    </header>
  );
}
