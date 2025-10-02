include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-pse
PKG_VERSION:=20250928
PKG_RELEASE:=1
LUCI_TITLE:=PoE Manager for Cudy C200P
LUCI_DEPENDS:=+luci-base +pse-daemon

PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=Cezary Jackiewicz <cezary@eko.one.pl>

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
