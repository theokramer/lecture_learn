import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:purchases_flutter/purchases_flutter.dart';
import '../providers/revenuecat_provider.dart';

/// Widget that displays RevenueCat Customer Center
class RevenueCatCustomerCenterWidget extends ConsumerWidget {
  final VoidCallback? onDismiss;

  const RevenueCatCustomerCenterWidget({
    super.key,
    this.onDismiss,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final revenueCatState = ref.watch(revenueCatProvider);
    final customerInfo = revenueCatState.customerInfo;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Subscription Management'),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () {
            if (onDismiss != null) {
              onDismiss!();
            } else {
              Navigator.of(context).pop();
            }
          },
        ),
      ),
      body: customerInfo == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                const SizedBox(height: 20),
                _buildSectionTitle('Subscription Status'),
                const SizedBox(height: 12),
                _buildStatusCard(customerInfo, revenueCatState.hasActiveSubscription),
                const SizedBox(height: 32),
                _buildSectionTitle('Active Entitlements'),
                const SizedBox(height: 12),
                if (customerInfo.entitlements.active.isEmpty)
                  const Card(
                    child: Padding(
                      padding: EdgeInsets.all(16),
                      child: Text('No active subscriptions'),
                    ),
                  )
                else
                  ...customerInfo.entitlements.active.entries.map((entry) {
                    return _buildEntitlementCard(entry.key, entry.value);
                  }),
                const SizedBox(height: 32),
                _buildSectionTitle('Actions'),
                const SizedBox(height: 12),
                ElevatedButton.icon(
                  onPressed: () async {
                    try {
                      await ref.read(revenueCatProvider.notifier).restorePurchases();
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Purchases restored successfully'),
                            backgroundColor: Colors.green,
                          ),
                        );
                      }
                    } catch (e) {
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('Failed to restore: ${e.toString()}'),
                            backgroundColor: Colors.red,
                          ),
                        );
                      }
                    }
                  },
                  icon: const Icon(Icons.restore),
                  label: const Text('Restore Purchases'),
                ),
              ],
            ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Text(
      title,
      style: const TextStyle(
        fontSize: 20,
        fontWeight: FontWeight.bold,
      ),
    );
  }

  Widget _buildStatusCard(CustomerInfo customerInfo, bool hasActive) {
    return Card(
      color: hasActive ? Colors.green.shade50 : Colors.grey.shade100,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Icon(
              hasActive ? Icons.check_circle : Icons.cancel,
              color: hasActive ? Colors.green : Colors.grey,
              size: 32,
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    hasActive ? 'Active Subscription' : 'No Active Subscription',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: hasActive ? Colors.green.shade900 : Colors.grey.shade700,
                    ),
                  ),
                  if (hasActive && customerInfo.entitlements.active.isNotEmpty)
                    Builder(
                      builder: (context) {
                        final firstEntitlement = customerInfo.entitlements.active.values.first;
                        if (firstEntitlement.expirationDate != null) {
                          return Text(
                            'Expires: ${_formatDate(firstEntitlement.expirationDate!)}',
                            style: TextStyle(
                              fontSize: 14,
                              color: Colors.grey.shade600,
                            ),
                          );
                        }
                        return const SizedBox.shrink();
                      },
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEntitlementCard(String identifier, EntitlementInfo entitlement) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              identifier,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text('Status: ${entitlement.isActive ? "Active" : "Inactive"}'),
            if (entitlement.expirationDate != null)
              Text('Expires: ${_formatDate(entitlement.expirationDate!)}'),
            if (entitlement.productIdentifier.isNotEmpty)
              Text('Product: ${entitlement.productIdentifier}'),
          ],
        ),
      ),
    );
  }

  String _formatDate(dynamic date) {
    if (date is DateTime) {
      return '${date.day}/${date.month}/${date.year}';
    } else if (date is String) {
      try {
        final parsed = DateTime.parse(date);
        return '${parsed.day}/${parsed.month}/${parsed.year}';
      } catch (e) {
        return date.toString();
      }
    }
    return date.toString();
  }
}

/// Helper function to show RevenueCat Customer Center as a modal
Future<void> showRevenueCatCustomerCenter(
  BuildContext context, {
  VoidCallback? onDismiss,
}) async {
  await Navigator.of(context).push(
    MaterialPageRoute(
      builder: (context) => const RevenueCatCustomerCenterWidget(),
      fullscreenDialog: true,
    ),
  );
}

