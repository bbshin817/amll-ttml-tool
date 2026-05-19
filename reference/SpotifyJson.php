<?php

namespace Src\Service\LyricFormatter;

use DOMDocument;
use DOMElement;
use DOMNode;
use DOMXPath;
use InvalidArgumentException;

class SpotifyJson
{
    private const TTML_NS = "http://www.w3.org/ns/ttml";
    private const ITUNES_NS = "http://music.apple.com/lyric-ttml-internal";
    private const TTM_NS = "http://www.w3.org/ns/ttml#metadata";
    private const XML_NS = "http://www.w3.org/XML/1998/namespace";

    private const ADD_SECTION_GAPS = true;

    public static function encode($xml, $withMetadata = false)
    {
        $dom = self::loadXml($xml);
        $xpath = new DOMXPath($dom);

        $body = self::first($xpath, "//*[local-name()='body']");

        if (!$body instanceof DOMElement) {
            throw new InvalidArgumentException("body element was not found.");
        }

        $agents = self::parseAgents($xpath);
        $bodyAgent = self::attr($body, "agent", self::TTM_NS);
        $divs = self::children($body, "div");
        $lyrics = [];

        foreach ($divs as $index => $div) {
            $divAgent = self::attr($div, "agent", self::TTM_NS) ?: $bodyAgent;
            $songPart = self::attr($div, "songPart", self::ITUNES_NS);

            foreach (self::children($div, "p") as $p) {
                $lineAgent = self::attr($p, "agent", self::TTM_NS) ?: $divAgent;
                $lyrics[] = self::parseLine($p, $lineAgent, $songPart, $agents);
            }

            if (self::ADD_SECTION_GAPS) {
                $nextBegin = isset($divs[$index + 1])
                    ? self::attr($divs[$index + 1], "begin")
                    : self::attr($body, "dur");

                self::appendGap($lyrics, $div, $nextBegin, $divAgent, $songPart, $agents);
            }
        }

        $result = $lyrics;

        if ($withMetadata) {
            $result = [
                "metadata" => self::parseMetadata($dom, $xpath, $body, $agents),
                "lyric" => $lyrics,
            ];
        }

        return json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    public static function decode($json)
    {
        $data = json_decode($json, true);

        if (!is_array($data)) {
            throw new InvalidArgumentException("Invalid JSON.");
        }

        return $data;
    }

    private static function parseLine(DOMElement $p, $agent, $songPart, array $agents)
    {
        $words = "";
        $syllables = [];
        $lastEndMs = null;
        $hasSpan = false;

        foreach ($p->childNodes as $node) {
            if ($node instanceof DOMElement && $node->localName === "span") {
                $hasSpan = true;
                self::appendSpan($node, $words, $syllables, $lastEndMs, $agent);
                continue;
            }

            if ($node->nodeType === XML_TEXT_NODE && $hasSpan) {
                self::appendTextBetweenSpans($node, $words, $syllables, $lastEndMs);
            }
        }

        if (!$hasSpan) {
            $words = $p->textContent;
        }

        $line = [
            "startTimeMs" => self::parseDuration(self::attr($p, "begin")),
            "words" => $words,
            "syllables" => $syllables,
            "endTimeMs" => self::parseDuration(self::attr($p, "end")),
            "isSmall" => false,
        ];

        $key = self::attr($p, "key", self::ITUNES_NS);

        if ($key) {
            $line["key"] = $key;
        }

        if ($agent) {
            $line["agent"] = $agent;

            if (isset($agents[$agent]["type"])) {
                $line["agentType"] = $agents[$agent]["type"];
            }
        }

        if ($songPart) {
            $line["songPart"] = $songPart;
        }

        return $line;
    }

    private static function appendSpan(DOMElement $span, &$words, array &$syllables, &$lastEndMs, $fallbackAgent)
    {
        $childSpans = self::children($span, "span");

        if (count($childSpans) > 0) {
            foreach ($childSpans as $childSpan) {
                $agent = self::attr($span, "agent", self::TTM_NS) ?: $fallbackAgent;
                self::appendSpan($childSpan, $words, $syllables, $lastEndMs, $agent);
            }

            return;
        }

        $text = $span->textContent;

        if ($text === "") {
            return;
        }

        $agent = self::attr($span, "agent", self::TTM_NS) ?: $fallbackAgent;
        $beginMs = self::parseDuration(self::attr($span, "begin"));
        $endMs = self::parseDuration(self::attr($span, "end"));

        $words .= $text;

        $syllable = [
            "startTimeMs" => $beginMs,
            "numChars" => self::charLength($text),
            "endTimeMs" => $endMs,
        ];

        if ($agent) {
            $syllable["agent"] = $agent;
        }

        $syllables[] = $syllable;
        $lastEndMs = $endMs;
    }

    private static function appendTextBetweenSpans(DOMNode $node, &$words, array &$syllables, $lastEndMs)
    {
        $text = $node->nodeValue;

        if ($text === "" || $lastEndMs === null) {
            return;
        }

        if (trim($text) === "" && !self::hasNextSpan($node)) {
            return;
        }

        if (trim($text) === "") {
            $text = preg_replace("/\s+/u", " ", $text);
        }

        if ($text === "") {
            return;
        }

        $words .= $text;

        $syllables[] = [
            "startTimeMs" => $lastEndMs,
            "numChars" => self::charLength($text),
            "endTimeMs" => $lastEndMs + 1,
        ];
    }

    private static function appendGap(array &$lyrics, DOMElement $div, $nextBegin, $agent, $songPart, array $agents)
    {
        $startMs = self::parseDuration(self::attr($div, "end"));
        $endMs = self::parseDuration($nextBegin);

        if ($startMs === null || $endMs === null || $endMs <= $startMs) {
            return;
        }

        $line = [
            "startTimeMs" => $startMs,
            "words" => "",
            "syllables" => [],
            "endTimeMs" => $endMs,
            "isSmall" => false,
        ];

        if ($agent) {
            $line["agent"] = $agent;

            if (isset($agents[$agent]["type"])) {
                $line["agentType"] = $agents[$agent]["type"];
            }
        }

        if ($songPart) {
            $line["songPart"] = $songPart;
        }

        $lyrics[] = $line;
    }

    private static function parseAgents(DOMXPath $xpath)
    {
        $agents = [];

        foreach ($xpath->query("//*[local-name()='agent']") as $node) {
            if (!$node instanceof DOMElement) {
                continue;
            }

            $id = self::attr($node, "id", self::XML_NS) ?: self::attr($node, "id");

            if (!$id) {
                continue;
            }

            $agents[$id] = [
                "id" => $id,
                "type" => self::attr($node, "type"),
            ];
        }

        return $agents;
    }

    private static function parseMetadata(DOMDocument $dom, DOMXPath $xpath, DOMElement $body, array $agents)
    {
        $tt = $dom->documentElement;
        $itunesMetadata = self::first($xpath, "//*[local-name()='iTunesMetadata']");
        $songwriters = [];

        foreach ($xpath->query("//*[local-name()='songwriter']") as $songwriter) {
            $songwriters[] = $songwriter->textContent;
        }

        return [
            "lang" => $tt instanceof DOMElement ? self::attr($tt, "lang", self::XML_NS) : null,
            "timing" => $tt instanceof DOMElement ? self::attr($tt, "timing", self::ITUNES_NS) : null,
            "durationMs" => self::parseDuration(self::attr($body, "dur")),
            "bodyAgent" => self::attr($body, "agent", self::TTM_NS),
            "leadingSilence" => $itunesMetadata instanceof DOMElement
                ? self::attr($itunesMetadata, "leadingSilence")
                : null,
            "songwriters" => $songwriters,
            "agents" => array_values($agents),
        ];
    }

    private static function loadXml($xml)
    {
        $dom = new DOMDocument();
        $dom->preserveWhiteSpace = true;

        $previous = libxml_use_internal_errors(true);
        $ok = $dom->loadXML($xml, LIBXML_NONET);
        $errors = libxml_get_errors();

        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        if (!$ok) {
            $message = isset($errors[0]) ? trim($errors[0]->message) : "Invalid XML.";
            throw new InvalidArgumentException($message);
        }

        return $dom;
    }

    private static function first(DOMXPath $xpath, $query)
    {
        $nodes = $xpath->query($query);

        if (!$nodes || $nodes->length === 0) {
            return null;
        }

        return $nodes->item(0);
    }

    private static function children(DOMElement $element, $localName)
    {
        $children = [];

        foreach ($element->childNodes as $child) {
            if ($child instanceof DOMElement && $child->localName === $localName) {
                $children[] = $child;
            }
        }

        return $children;
    }

    private static function hasNextSpan(DOMNode $node)
    {
        $next = $node->nextSibling;

        while ($next) {
            if ($next instanceof DOMElement) {
                return $next->localName === "span";
            }

            if ($next->nodeType === XML_TEXT_NODE && trim($next->nodeValue) !== "") {
                return false;
            }

            $next = $next->nextSibling;
        }

        return false;
    }

    private static function attr(DOMElement $element, $name, $namespace = null)
    {
        if ($namespace && $element->hasAttributeNS($namespace, $name)) {
            return $element->getAttributeNS($namespace, $name);
        }

        if ($element->hasAttribute($name)) {
            return $element->getAttribute($name);
        }

        return null;
    }

    private static function parseDuration($duration)
    {
        if ($duration === null || $duration === "") {
            return null;
        }

        $duration = trim((string) $duration);

        if (substr($duration, -2) === "ms") {
            return (int) round((float) substr($duration, 0, -2));
        }

        if (substr($duration, -1) === "s") {
            return (int) round((float) substr($duration, 0, -1) * 1000);
        }

        $parts = explode(":", $duration);
        $seconds = 0.0;

        foreach ($parts as $part) {
            $seconds = ($seconds * 60) + (float) $part;
        }

        return (int) round($seconds * 1000);
    }

    private static function charLength($text)
    {
        preg_match_all("/./us", (string) $text, $matches);

        return count($matches[0] ?? []);
    }
}

?>
