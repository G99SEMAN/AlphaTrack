package main

import (
	"bufio"
	"fmt"
	"net"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"time"
)

const (
	colorReset  = "\033[0m"
	colorGreen  = "\033[32m"
	colorCyan   = "\033[36m"
	colorYellow = "\033[33m"
	colorRed    = "\033[31m"
)

func main() {
	// Projektverzeichnis: exe liegt in scripts/windows/, also 2 Ebenen hoch
	exePath, err := os.Executable()
	if err != nil {
		exePath = os.Args[0]
	}
	exeDir := filepath.Dir(exePath)
	projectRoot := filepath.Join(exeDir, "..", "..")
	projectRoot, _ = filepath.Abs(projectRoot)

	// Falls package.json nicht gefunden (z.B. exe direkt im Root), Root-Verzeichnis direkt nutzen
	if _, err := os.Stat(filepath.Join(projectRoot, "package.json")); os.IsNotExist(err) {
		projectRoot = exeDir
	}

	printHeader()

	// Node.js / npm prüfen
	npmPath := findNpm()
	if npmPath == "" {
		fmt.Printf("%s FEHLER: Node.js / npm nicht gefunden!%s\n", colorRed, colorReset)
		fmt.Println()
		fmt.Println(" Bitte Node.js installieren:")
		fmt.Printf(" %shttps://nodejs.org%s\n", colorCyan, colorReset)
		fmt.Println()
		fmt.Println(" Danach dieses Programm neu starten.")
		fmt.Println()
		fmt.Print(" [Enter] druecken zum Beenden...")
		bufio.NewReader(os.Stdin).ReadString('\n')
		os.Exit(1)
	}

	// node_modules prüfen
	nodeModulesPath := filepath.Join(projectRoot, "node_modules")
	if _, err := os.Stat(nodeModulesPath); os.IsNotExist(err) {
		fmt.Printf("%s Abhaengigkeiten werden installiert (einmalig)...%s\n", colorYellow, colorReset)
		fmt.Println()
		installCmd := exec.Command(npmPath, "install")
		installCmd.Dir = projectRoot
		installCmd.Stdout = os.Stdout
		installCmd.Stderr = os.Stderr
		if err := installCmd.Run(); err != nil {
			fmt.Printf("%s FEHLER: npm install fehlgeschlagen.%s\n", colorRed, colorReset)
			waitForEnter()
			os.Exit(1)
		}
		fmt.Println()
	}

	// Lokale IP ermitteln
	ip := getLocalIP()

	fmt.Printf(" Lokale URL:   %shttp://localhost:3000%s\n", colorCyan, colorReset)
	if ip != "" {
		fmt.Printf(" Netzwerk URL: %shttp://%s:3000%s\n", colorCyan, ip, colorReset)
	}
	fmt.Println()
	fmt.Println(" Server laeuft... Fenster schliessen oder Strg+C zum Beenden.")
	fmt.Println(" ------------------------------------------")
	fmt.Println()

	// Server starten
	serverCmd := exec.Command(npmPath, "run", "dev")
	serverCmd.Dir = projectRoot
	serverCmd.Stdout = os.Stdout
	serverCmd.Stderr = os.Stderr

	if err := serverCmd.Start(); err != nil {
		fmt.Printf("%s FEHLER: Server konnte nicht gestartet werden: %v%s\n", colorRed, err, colorReset)
		waitForEnter()
		os.Exit(1)
	}

	// Browser nach 3 Sekunden öffnen
	go func() {
		time.Sleep(3 * time.Second)
		openBrowser("http://localhost:3000")
	}()

	// Sauberes Beenden bei Strg+C
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sig
		fmt.Println()
		fmt.Println(" Server wird beendet...")
		serverCmd.Process.Kill()
		os.Exit(0)
	}()

	serverCmd.Wait()
	fmt.Println()
	fmt.Println(" Server wurde beendet.")
	waitForEnter()
}

func printHeader() {
	fmt.Println()
	fmt.Printf("%s ==========================================%s\n", colorGreen, colorReset)
	fmt.Printf("%s   AlphaTrack - Development Server%s\n", colorGreen, colorReset)
	fmt.Printf("%s ==========================================%s\n", colorGreen, colorReset)
	fmt.Println()
}

func findNpm() string {
	// Erst im PATH suchen
	if path, err := exec.LookPath("npm"); err == nil {
		return path
	}
	// Typische Windows-Pfade
	candidates := []string{
		`C:\Program Files\nodejs\npm.cmd`,
		`C:\Program Files (x86)\nodejs\npm.cmd`,
		filepath.Join(os.Getenv("APPDATA"), `npm\npm.cmd`),
		filepath.Join(os.Getenv("ProgramFiles"), `nodejs\npm.cmd`),
	}
	for _, c := range candidates {
		if _, err := os.Stat(c); err == nil {
			return c
		}
	}
	return ""
}

func getLocalIP() string {
	conn, err := net.Dial("udp", "8.8.8.8:80")
	if err != nil {
		return ""
	}
	defer conn.Close()
	addr := conn.LocalAddr().(*net.UDPAddr)
	return addr.IP.String()
}

func openBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("cmd", "/c", "start", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	cmd.Start()
}

func waitForEnter() {
	fmt.Print(" [Enter] druecken zum Beenden...")
	bufio.NewReader(os.Stdin).ReadString('\n')
}

func init() {
	// Windows: ANSI-Farben aktivieren
	if runtime.GOOS == "windows" {
		// Farben in Windows Terminal / modern cmd werden unterstützt
		_ = strings.Contains("", "")
	}
}
