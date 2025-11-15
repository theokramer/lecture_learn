import 'package:flutter/material.dart';
import 'package:flutter_html/flutter_html.dart';
import 'package:flutter_math_fork/flutter_math.dart';
import '../utils/study_mode_colors.dart';
import '../models/study_content.dart';

/// Widget that renders HTML content with LaTeX math formula support
/// Matches the website's MarkdownRenderer behavior
class HtmlWithLatexRenderer extends StatelessWidget {
  final String htmlContent;

  const HtmlWithLatexRenderer({
    super.key,
    required this.htmlContent,
  });

  @override
  Widget build(BuildContext context) {
    // Process HTML to extract LaTeX and create a renderable structure
    final processedContent = _processContent(htmlContent);

    return Html(
      data: processedContent,
      style: {
        'body': Style(
          margin: Margins.zero,
          padding: HtmlPaddings.zero,
          color: const Color(0xFFFFFFFF),
        ),
        'p': Style(
          color: const Color(0xFFFFFFFF),
          fontSize: FontSize(16),
          margin: Margins.symmetric(vertical: 16),
          lineHeight: LineHeight(1.75),
        ),
        'h1': Style(
          color: const Color(0xFFFFFFFF),
          fontSize: FontSize(32),
          fontWeight: FontWeight.bold,
          margin: Margins.only(top: 32, bottom: 16),
          lineHeight: LineHeight(1.2),
        ),
        'h2': Style(
          color: const Color(0xFFFFFFFF),
          fontSize: FontSize(24),
          fontWeight: FontWeight.w600,
          margin: Margins.only(top: 24, bottom: 12),
          lineHeight: LineHeight(1.3),
        ),
        'h3': Style(
          color: const Color(0xFFFFFFFF),
          fontSize: FontSize(20),
          fontWeight: FontWeight.w600,
          margin: Margins.only(top: 20, bottom: 8),
          lineHeight: LineHeight(1.4),
        ),
        'ul': Style(
          color: const Color(0xFFFFFFFF),
          margin: Margins.symmetric(vertical: 16),
          padding: HtmlPaddings.only(left: 32),
          listStyleType: ListStyleType.disc,
        ),
        'ol': Style(
          color: const Color(0xFFFFFFFF),
          margin: Margins.symmetric(vertical: 16),
          padding: HtmlPaddings.only(left: 32),
          listStyleType: ListStyleType.decimal,
        ),
        'li': Style(
          color: const Color(0xFFFFFFFF),
          margin: Margins.symmetric(vertical: 8),
        ),
        'blockquote': Style(
          color: const Color(0xFFFFFFFF),
          backgroundColor: Colors.transparent, // Remove any background color
          border: Border(
            left: BorderSide(
              color: const Color(0xFFFFFFFF),
              width: 4,
            ),
          ),
          padding: HtmlPaddings.only(left: 24),
          margin: Margins.symmetric(vertical: 24),
          fontStyle: FontStyle.italic,
        ),
        'a': Style(
          color: const Color(0xFF60A5FA),
          textDecoration: TextDecoration.underline,
        ),
        'strong': Style(
          fontWeight: FontWeight.bold,
          color: StudyModeColors.getColor(StudyMode.summary), // Blue color matching summary button
        ),
        'em': Style(
          fontStyle: FontStyle.italic,
          color: const Color(0xFFFFFFFF),
        ),
        'mark': Style(
          backgroundColor: StudyModeColors.getColor(StudyMode.summary), // Summary button blue background
          color: const Color(0xFFFFFFFF), // White text for contrast
          padding: HtmlPaddings.symmetric(horizontal: 2, vertical: 1),
        ),
        'table': Style(
          margin: Margins.symmetric(vertical: 24),
          border: Border.all(color: const Color(0xFF4A4A4A), width: 1),
          width: Width(100, Unit.percent),
        ),
        'thead': Style(
          backgroundColor: const Color(0xFF2A2A2A),
        ),
        'th': Style(
          backgroundColor: const Color(0xFF2A2A2A),
          color: const Color(0xFFFFFFFF),
          fontWeight: FontWeight.w600,
          padding: HtmlPaddings.symmetric(horizontal: 16, vertical: 12),
          border: Border.all(color: const Color(0xFF4A4A4A), width: 1),
          textAlign: TextAlign.left,
        ),
        'tbody': Style(
          backgroundColor: const Color(0xFF1A1A1A),
        ),
        'tr': Style(
          border: Border(
            bottom: BorderSide(
              color: const Color(0xFF4A4A4A),
              width: 1,
            ),
          ),
        ),
        'td': Style(
          backgroundColor: const Color(0xFF1A1A1A),
          color: const Color(0xFFFFFFFF),
          padding: HtmlPaddings.symmetric(horizontal: 16, vertical: 12),
          border: Border.all(color: const Color(0xFF4A4A4A), width: 1),
          textAlign: TextAlign.left,
        ),
        'code': Style(
          backgroundColor: const Color(0xFF1A1A1A),
          color: const Color(0xFFFFFFFF), // White color
          padding: HtmlPaddings.symmetric(horizontal: 8, vertical: 4),
          fontSize: FontSize(14),
          fontFamily: 'monospace',
        ),
        'pre': Style(
          backgroundColor: const Color(0xFF1A1A1A),
          padding: HtmlPaddings.all(16),
          margin: Margins.symmetric(vertical: 24),
          border: Border.all(color: const Color(0xFF3A3A3A), width: 1),
        ),
        'span': Style(
          // Default span style - will be overridden by inline styles
          color: const Color(0xFFFFFFFF),
        ),
      },
      extensions: [
        // Custom extension to handle LaTeX formulas
        _LatexTagExtension(),
        // Custom extension to handle colored spans with inline styles
        _ColoredSpanExtension(),
      ],
    );
  }

  /// Process HTML content to extract LaTeX formulas and wrap them in special tags
  /// This allows flutter_html to render them using custom widgets
  String _processContent(String html) {
    String processed = html;
    
    // First, process block math \[...\] (LaTeX block format)
    // Match \[...\] patterns, handling multiline formulas
    processed = processed.replaceAllMapped(
      RegExp(r'\\\[([\s\S]*?)\\\]', multiLine: true),
      (match) {
        final formula = match.group(1)?.trim() ?? '';
        // Wrap in a span with data attributes for custom rendering
        return '<span data-latex="${_escapeHtml(formula)}" data-latex-type="block"></span>';
      },
    );
    
    // Then process block math ($$$$...$$$$) - 4 dollar signs
    // Process this BEFORE $$ to avoid conflicts
    // Match $$$$...$$$$ patterns, handling multiline formulas
    processed = processed.replaceAllMapped(
      RegExp(r'\$\$\$\$([\s\S]*?)\$\$\$\$', multiLine: true),
      (match) {
        final formula = match.group(1)?.trim() ?? '';
        // Wrap in a span with data attributes for custom rendering
        return '<span data-latex="${_escapeHtml(formula)}" data-latex-type="block"></span>';
      },
    );
    
    // Then process block math ($$...$$) - 2 dollar signs
    // Match $$...$$ patterns, handling multiline formulas
    // This regex ensures we don't match $$$$ patterns (already processed)
    processed = processed.replaceAllMapped(
      RegExp(r'(?<!\$)\$\$(?!\$)([\s\S]*?)(?<!\$)\$\$(?!\$)', multiLine: true),
      (match) {
        final formula = match.group(1)?.trim() ?? '';
        // Wrap in a span with data attributes for custom rendering
        return '<span data-latex="${_escapeHtml(formula)}" data-latex-type="block"></span>';
      },
    );
    
    // Then process inline math \(...\) (LaTeX inline format)
    // Match \(...\) patterns
    processed = processed.replaceAllMapped(
      RegExp(r'\\\(([\s\S]*?)\\\)', multiLine: true),
      (match) {
        final formula = match.group(1)?.trim() ?? '';
        // Wrap in a span with data attributes for custom rendering
        return '<span data-latex="${_escapeHtml(formula)}" data-latex-type="inline"></span>';
      },
    );
    
    // Finally process inline math ($...$)
    // Match $...$ patterns, but not $$...$$ or $$$$...$$$$ (already processed)
    // Use negative lookbehind and lookahead to ensure we don't match part of $$ or $$$$
    processed = processed.replaceAllMapped(
      RegExp(r'(?<!\$)\$(?!\$)([^\$\n]+?)\$(?!\$)'),
      (match) {
        final formula = match.group(1)?.trim() ?? '';
        // Wrap in a span with data attributes for custom rendering
        return '<span data-latex="${_escapeHtml(formula)}" data-latex-type="inline"></span>';
      },
    );
    
    return processed;
  }

  /// Escape HTML special characters in LaTeX formulas
  String _escapeHtml(String text) {
    return text
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
  }
}

/// Custom extension to handle colored spans with inline styles
class _ColoredSpanExtension extends TagExtension {
  _ColoredSpanExtension()
      : super(
          tagsToExtend: {'span'},
          builder: (extensionContext) {
            final element = extensionContext.element;
            final styleAttr = element?.attributes['style'];
            
            // Only process if it has a style attribute and is not a LaTeX span
            if (styleAttr != null && 
                styleAttr.isNotEmpty &&
                !(element?.attributes.containsKey('data-latex') ?? false)) {
              // Parse color from style attribute (e.g., "color:#10b981" or "color: #ef4444")
              final colorMatch = RegExp(r'color:\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})')
                  .firstMatch(styleAttr);
              
              if (colorMatch != null) {
                final colorHex = colorMatch.group(1);
                if (colorHex != null) {
                  try {
                    // Convert hex to Color
                    final color = _hexToColorStatic(colorHex);
                    // Render the inner HTML content with the specified color
                    return Html(
                      data: extensionContext.innerHtml,
                      style: {
                        'body': Style(
                          margin: Margins.zero,
                          padding: HtmlPaddings.zero,
                          color: color,
                        ),
                        'p': Style(color: color),
                        'span': Style(color: color),
                        'strong': Style(color: color),
                        'em': Style(color: color),
                      },
                    );
                  } catch (e) {
                    // If color parsing fails, render without color
                    return Html(
                      data: extensionContext.innerHtml,
                      style: {
                        'body': Style(
                          margin: Margins.zero,
                          padding: HtmlPaddings.zero,
                        ),
                      },
                    );
                  }
                }
              }
            }
            
            // If we matched but couldn't process, still render the content
            return Html(
              data: extensionContext.innerHtml,
              style: {
                'body': Style(
                  margin: Margins.zero,
                  padding: HtmlPaddings.zero,
                ),
              },
            );
          },
        );

  @override
  bool matches(ExtensionContext context) {
    // Only match spans that have style attribute with color and are not LaTeX
    return super.matches(context) &&
        (context.element?.attributes.containsKey('style') ?? false) &&
        !(context.element?.attributes.containsKey('data-latex') ?? false) &&
        (context.element?.attributes['style']?.contains('color:') ?? false);
  }

  /// Convert hex color string to Color object (static helper)
  static Color _hexToColorStatic(String hex) {
    // Remove # if present
    hex = hex.replaceAll('#', '');
    
    // Handle 3-digit hex (e.g., #fff -> #ffffff)
    if (hex.length == 3) {
      hex = hex.split('').map((c) => c + c).join();
    }
    
    // Parse hex to int
    final value = int.parse(hex, radix: 16);
    
    // Add alpha channel (0xFF for fully opaque)
    return Color(0xFF000000 | value);
  }
}

/// Custom extension that only matches spans with data-latex attribute
class _LatexTagExtension extends TagExtension {
  _LatexTagExtension()
      : super(
          tagsToExtend: {'span'},
          builder: (extensionContext) {
            final element = extensionContext.element;
            final latex = element?.attributes['data-latex'];
            final isBlock = element?.attributes['data-latex-type'] == 'block';
            
            // Only render LaTeX if the data-latex attribute exists
            if (latex != null && latex.isNotEmpty) {
              return Padding(
                padding: isBlock
                    ? const EdgeInsets.symmetric(vertical: 16)
                    : const EdgeInsets.symmetric(horizontal: 4),
                child: Math.tex(
                  latex,
                  mathStyle: isBlock ? MathStyle.display : MathStyle.text,
                  textStyle: const TextStyle(
                    color: Color(0xFFFFFFFF),
                    fontSize: 16,
                  ),
                  onErrorFallback: (error) {
                    // If LaTeX rendering fails, show the original formula
                    return Text(
                      '\$${isBlock ? '\$' : ''}$latex${isBlock ? '\$\$' : '\$'}',
                      style: const TextStyle(color: Color(0xFFFFFFFF)),
                    );
                  },
                ),
              );
            }
            
            // This shouldn't happen since matches() filters for data-latex
            // But return empty widget just in case
            return const SizedBox.shrink();
          },
        );

  @override
  bool matches(ExtensionContext context) {
    // Only match spans that have the data-latex attribute
    return super.matches(context) &&
        (context.element?.attributes.containsKey('data-latex') ?? false);
  }
}
